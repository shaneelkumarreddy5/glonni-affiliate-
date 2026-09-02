'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedBlocks = ['hero', 'banner', 'text', 'cta', 'faq', 'product_rail', 'store_rail', 'category_grid', 'trust_strip'] as const;
const toSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const cleanText = (value: FormDataEntryValue | null, max = 220) => String(value ?? '').trim().slice(0, max);
const safeHref = (value: FormDataEntryValue | null) => {
  const href = cleanText(value, 500);
  return href && /^\/(?!\/)/.test(href) ? href : null;
};

async function contentAdmin() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin', 'editor'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') {
    throw new Error('An active 2FA-protected content-admin session is required.');
  }
  return { supabase, user, role: profile.role };
}

async function snapshotPage(pageId: string, note: string, actorId: string) {
  const supabase = await createClient();
  const [{ data: page }, { data: blocks }, { count }] = await Promise.all([
    supabase.from('site_pages').select('id,title,slug,status,device_visibility').eq('id', pageId).single(),
    supabase.from('site_page_blocks').select('*').eq('page_id', pageId).order('display_order'),
    supabase.from('site_page_versions').select('*', { count: 'exact', head: true }).eq('page_id', pageId),
  ]);
  if (page) await supabase.from('site_page_versions').insert({ page_id: pageId, version_number: (count ?? 0) + 1, snapshot: { page, blocks }, change_note: note, created_by: actorId });
}

export async function createBuilderPage(formData: FormData) {
  const { supabase, user } = await contentAdmin();
  const title = cleanText(formData.get('title'), 120);
  const slug = toSlug(cleanText(formData.get('slug'), 120) || title);
  if (title.length < 2 || !slug) throw new Error('Enter a page title and URL handle.');
  const { data, error } = await supabase.from('site_pages').insert({ title, slug, description: cleanText(formData.get('description'), 280) || null, device_visibility: cleanText(formData.get('device'), 20) || 'all', created_by: user.id }).select('id').single();
  if (error || !data) throw new Error(error?.message || 'Could not create the page.');
  await snapshotPage(data.id, 'Page created', user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_page_created', entity_type: 'site_page', entity_id: data.id, source: 'admin', metadata: { slug } });
  revalidatePath('/admin/cms');
}

export async function updateBuilderPage(formData: FormData) {
  const { supabase, user } = await contentAdmin();
  const id = cleanText(formData.get('id'), 80);
  const title = cleanText(formData.get('title'), 120);
  const slug = toSlug(cleanText(formData.get('slug'), 120) || title);
  if (!id || title.length < 2 || !slug) throw new Error('Enter a page title and URL handle.');
  const { data, error } = await supabase.from('site_pages').update({ title, slug, description: cleanText(formData.get('description'), 280) || null, device_visibility: cleanText(formData.get('device'), 20) || 'all', updated_at: new Date().toISOString() }).eq('id', id).select('slug').single();
  if (error || !data) throw new Error(error?.message || 'Could not update the page.');
  await snapshotPage(id, 'Edited page settings', user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_page_updated', entity_type: 'site_page', entity_id: id, source: 'admin', metadata: { slug: data.slug } });
  revalidatePath('/admin/cms');
  revalidatePath(`/pages/${data.slug}`);
}

export async function duplicateBuilderPage(formData: FormData) {
  const { supabase, user } = await contentAdmin();
  const id = cleanText(formData.get('id'), 80);
  const { data: original, error: originalError } = await supabase.from('site_pages').select('title,slug,description,device_visibility').eq('id', id).single();
  if (originalError || !original) throw new Error('Page not found.');
  const { data: copy, error } = await supabase.from('site_pages').insert({ title: `${original.title} copy`, slug: `${original.slug}-${Date.now().toString().slice(-6)}`, description: original.description, device_visibility: original.device_visibility, created_by: user.id }).select('id,slug').single();
  if (error || !copy) throw new Error(error?.message || 'Could not duplicate the page.');
  const { data: originalBlocks } = await supabase.from('site_page_blocks').select('block_type,title,body,cta_label,cta_href,image_url,config,display_order,device_visibility,is_active').eq('page_id', id).order('display_order');
  if (originalBlocks?.length) await supabase.from('site_page_blocks').insert(originalBlocks.map((block) => ({ ...block, page_id: copy.id })));
  await snapshotPage(copy.id, `Duplicated from ${original.slug}`, user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_page_duplicated', entity_type: 'site_page', entity_id: copy.id, source: 'admin', metadata: { source_page_id: id, slug: copy.slug } });
  revalidatePath('/admin/cms');
}

export async function deleteBuilderPage(formData: FormData) {
  const { supabase, user, role } = await contentAdmin();
  const id = cleanText(formData.get('id'), 80);
  if (!['owner', 'admin'].includes(role)) throw new Error('Only an owner or admin can delete a page.');
  const { data: page } = await supabase.from('site_pages').select('slug,status').eq('id', id).single();
  if (!page) throw new Error('Page not found.');
  const { error } = await supabase.from('site_pages').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_page_deleted', entity_type: 'site_page', entity_id: id, source: 'admin', metadata: { slug: page.slug, status: page.status } });
  revalidatePath('/admin/cms');
  revalidatePath(`/pages/${page.slug}`);
}

export async function addBuilderBlock(formData: FormData) {
  const { supabase, user } = await contentAdmin();
  const pageId = cleanText(formData.get('pageId'), 80);
  const type = cleanText(formData.get('type'), 40) as typeof allowedBlocks[number];
  if (!pageId || !allowedBlocks.includes(type)) throw new Error('Choose a page and an approved section type.');
  const { data: existing } = await supabase.from('site_page_blocks').select('display_order').eq('page_id', pageId).order('display_order', { ascending: false }).limit(1).maybeSingle();
  const config = { accent: '#1454d9', background: type === 'hero' ? '#fff4cf' : '#ffffff', buttonStyle: 'solid', layout: 'standard' };
  const { data, error } = await supabase.from('site_page_blocks').insert({ page_id: pageId, block_type: type, title: cleanText(formData.get('title'), 120) || `${type.replace('_', ' ')} section`, body: cleanText(formData.get('body'), 320) || null, cta_label: cleanText(formData.get('ctaLabel'), 60) || null, cta_href: safeHref(formData.get('ctaHref')), image_url: cleanText(formData.get('imageUrl'), 1000) || null, display_order: (existing?.display_order ?? 0) + 10, device_visibility: cleanText(formData.get('device'), 20) || 'all', config }).select('id').single();
  if (error || !data) throw new Error(error?.message || 'Could not add the section.');
  await snapshotPage(pageId, `Added ${type} section`, user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_block_added', entity_type: 'site_page_block', entity_id: data.id, source: 'admin', metadata: { page_id: pageId, type } });
  revalidatePath('/admin/cms');
}

export async function updateBuilderBlock(formData: FormData) {
  const { supabase, user } = await contentAdmin();
  const id = cleanText(formData.get('id'), 80);
  const pageId = cleanText(formData.get('pageId'), 80);
  if (!id || !pageId) throw new Error('Section not found.');
  const color = cleanText(formData.get('accent'), 12);
  const background = cleanText(formData.get('background'), 12);
  const config = { accent: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#1454d9', background: /^#[0-9a-fA-F]{6}$/.test(background) ? background : '#ffffff', buttonStyle: ['solid', 'outline', 'soft'].includes(cleanText(formData.get('buttonStyle'), 12)) ? cleanText(formData.get('buttonStyle'), 12) : 'solid', layout: ['standard', 'split', 'centered'].includes(cleanText(formData.get('layout'), 12)) ? cleanText(formData.get('layout'), 12) : 'standard' };
  const { error } = await supabase.from('site_page_blocks').update({ title: cleanText(formData.get('title'), 120) || null, body: cleanText(formData.get('body'), 320) || null, cta_label: cleanText(formData.get('ctaLabel'), 60) || null, cta_href: safeHref(formData.get('ctaHref')), image_url: cleanText(formData.get('imageUrl'), 1000) || null, device_visibility: cleanText(formData.get('device'), 20) || 'all', config, updated_at: new Date().toISOString() }).eq('id', id).eq('page_id', pageId);
  if (error) throw new Error(error.message);
  await snapshotPage(pageId, 'Edited section settings', user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_block_updated', entity_type: 'site_page_block', entity_id: id, source: 'admin', metadata: { page_id: pageId } });
  revalidatePath('/admin/cms');
}

export async function reorderBuilderBlocks(formData: FormData) {
  const { supabase, user } = await contentAdmin();
  const pageId = cleanText(formData.get('pageId'), 80);
  let blockIds: string[] = [];
  try { blockIds = JSON.parse(cleanText(formData.get('blockIds'), 4000)); } catch { throw new Error('Invalid section order.'); }
  if (!pageId || !Array.isArray(blockIds) || blockIds.length > 80) throw new Error('Invalid section order.');
  const { data: permitted } = await supabase.from('site_page_blocks').select('id').eq('page_id', pageId).in('id', blockIds);
  if ((permitted?.length ?? 0) !== blockIds.length) throw new Error('A section is unavailable.');
  await Promise.all(blockIds.map((id, index) => supabase.from('site_page_blocks').update({ display_order: (index + 1) * 10, updated_at: new Date().toISOString() }).eq('id', id).eq('page_id', pageId)));
  await snapshotPage(pageId, 'Reordered page sections', user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'site_blocks_reordered', entity_type: 'site_page', entity_id: pageId, source: 'admin', metadata: { count: blockIds.length } });
  revalidatePath('/admin/cms');
}

export async function setBuilderPageStatus(formData: FormData) {
  const { supabase, user, role } = await contentAdmin();
  const id = cleanText(formData.get('id'), 80);
  const action = cleanText(formData.get('action'), 20);
  const status = action === 'submit' ? 'pending' : action === 'publish' ? 'published' : action === 'pause' ? 'paused' : 'draft';
  if (['publish', 'pause'].includes(action) && !['owner', 'admin'].includes(role)) throw new Error('Only an owner or admin can publish or pause a page.');
  const values = status === 'published' ? { status, published_at: new Date().toISOString(), approved_by: user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() } : { status, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('site_pages').update(values).eq('id', id).select('id,slug').single();
  if (error || !data) throw new Error(error?.message || 'Page not found.');
  await snapshotPage(id, `Status changed to ${status}`, user.id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: `site_page_${status}`, entity_type: 'site_page', entity_id: id, source: 'admin', metadata: { slug: data.slug } });
  revalidatePath('/admin/cms');
  revalidatePath(`/pages/${data.slug}`);
}
