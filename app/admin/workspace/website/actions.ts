'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { coreSectionsByPage, defaultWebsiteSectionOrder, slotsByPage, websitePageOptions, type WebsiteBannerSlide, type WebsiteDraftBlock, type WebsiteLayoutSnapshot, type WebsitePageKey } from '@/lib/website-layout';

export type WebsiteActionResult = { ok: true; message: string } | { ok: false; error: string };

type WebsiteAuthorization = { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getUser']>>['data']['user']> } | { ok: false; error: string };

async function authorizeWebsiteChange(): Promise<WebsiteAuthorization> {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user) return { ok: false, error: 'Sign in to the admin panel to edit the website.' };
  if (assurance?.currentLevel !== 'aal2') return { ok: false, error: 'Complete two-step verification before saving or publishing website changes.' };
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner', 'admin', 'editor'].includes(profile.role) || employee?.status !== 'active') {
    return { ok: false, error: 'An active Owner, Admin, or Editor account is required to change the website.' };
  }
  return { ok: true, supabase, user };
}

function validLink(value: string) {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validImage(value: string) {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function normalizeBlocks(pageKey: WebsitePageKey, value: unknown): WebsiteDraftBlock[] | string {
  if (!Array.isArray(value) || value.length > 60) return 'The layout must contain no more than 60 sections.';
  const allowedSlots = new Set(slotsByPage[pageKey].map((slot) => slot.key));
  const output: WebsiteDraftBlock[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return 'A section contains invalid data.';
    const item = raw as Record<string, unknown>;
    const type = item.block_type;
    if (!['hero', 'banner', 'product_rail', 'store_rail'].includes(String(type))) return 'Choose a supported banner or product section.';
    if (type === 'hero' && pageKey !== 'home') return 'Hero banners can only be added to the home page.';
    const id = String(item.id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return 'A section identifier is invalid. Remove it and add the section again.';
    const title = String(item.title ?? '').trim();
    const body = String(item.body ?? '').trim();
    const ctaLabel = String(item.cta_label ?? '').trim();
    const ctaHref = String(item.cta_href ?? '').trim();
    const imageUrl = String(item.image_url ?? '').trim();
    const deviceVisibility = String(item.device_visibility ?? 'all');
    const rawConfig = item.config && typeof item.config === 'object' ? item.config as Record<string, unknown> : {};
    const slot = String(rawConfig.slot ?? '');
    if (!allowedSlots.has(slot as never)) return 'Choose a valid placement for this page.';
    if (title.length > 120 || body.length > 1800 || ctaLabel.length > 60 || ctaHref.length > 500 || imageUrl.length > 1000) return 'A section has text or an image address that is too long.';
    if (!validLink(ctaHref) || !validImage(imageUrl)) return 'Buttons and images must use a safe site path or HTTPS address.';
    if (ctaLabel && !ctaHref) return 'Add a destination for the button or clear its label.';
    if (!['all', 'desktop', 'mobile'].includes(deviceVisibility)) return 'Choose a supported device visibility.';

    const storeSlug = String(rawConfig.store_slug ?? '').trim();
    const categorySlug = String(rawConfig.category_slug ?? '').trim();
    const sourceMode = rawConfig.source_mode === 'curated' ? 'curated' : 'all';
    const sortValue = String(rawConfig.sort ?? 'best_deal');
    const sort = ['best_deal', 'trending', 'price_drop', 'newest'].includes(sortValue) ? sortValue as WebsiteDraftBlock['config']['sort'] : 'best_deal';
    const count = Math.max(1, Math.min(50, Number(rawConfig.count ?? 10) || 10));
    const productIds = Array.isArray(rawConfig.product_ids) ? rawConfig.product_ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50) : [];
    const mobileImage = String(rawConfig.mobile_image_url ?? '').trim();
    const bannerSize = ['wide', 'strip', 'square'].includes(String(rawConfig.banner_size)) ? rawConfig.banner_size as 'wide' | 'strip' | 'square' : 'wide';
    const color = (candidate: unknown, fallback: string) => typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
    const startsAt = String(rawConfig.starts_at ?? '').trim();
    const endsAt = String(rawConfig.ends_at ?? '').trim();
    const slideCount = Math.max(1, Math.min(10, Number(rawConfig.slide_count ?? 1) || 1));
    const rawSlides = Array.isArray(rawConfig.slides) ? rawConfig.slides : [];
    const slides: WebsiteBannerSlide[] = rawSlides.slice(0, slideCount - 1).map((candidate) => {
      const slide = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {};
      return {
        title: String(slide.title ?? '').trim().slice(0, 120),
        body: String(slide.body ?? '').trim().slice(0, 1800),
        image_url: String(slide.image_url ?? '').trim().slice(0, 1000),
        cta_label: String(slide.cta_label ?? '').trim().slice(0, 60),
        cta_href: String(slide.cta_href ?? '').trim().slice(0, 500),
      };
    });
    if (mobileImage && !validImage(mobileImage)) return 'The mobile banner image must use a safe site path or HTTPS address.';
    if (slides.some((slide) => !validImage(slide.image_url) || !validLink(slide.cta_href) || (slide.cta_label && !slide.cta_href))) return 'Each slide must use a safe image and button destination.';
    if ((type === 'store_rail' || (pageKey === 'stores' && storeSlug)) && !/^[a-z0-9-]{1,100}$/.test(storeSlug)) return 'Select a connected store for this store rail.';
    if (startsAt && Number.isNaN(Date.parse(startsAt))) return 'Choose a valid banner start date.';
    if (endsAt && Number.isNaN(Date.parse(endsAt))) return 'Choose a valid banner end date.';
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return 'The end date must be after the start date.';

    output.push({
      id,
      block_type: type as WebsiteDraftBlock['block_type'],
      title,
      body,
      cta_label: ctaLabel,
      cta_href: ctaHref,
      image_url: imageUrl,
      device_visibility: deviceVisibility as WebsiteDraftBlock['device_visibility'],
      is_active: item.is_active !== false,
      config: {
        slot: slot as WebsiteDraftBlock['config']['slot'],
        store_slug: storeSlug || undefined,
        category_slug: categorySlug || undefined,
        source_mode: sourceMode,
        product_ids: productIds,
        count,
        sort,
        mobile_image_url: mobileImage || undefined,
        banner_size: bannerSize,
        accent: color(rawConfig.accent, '#1554d1'),
        background: color(rawConfig.background, '#f2f6ff'),
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
        slide_count: type === 'hero' || type === 'banner' ? slideCount : undefined,
        slides: type === 'hero' || type === 'banner' ? slides : undefined,
      },
    });
  }
  return output;
}

function normalizeOrder(pageKey: WebsitePageKey, blocks: WebsiteDraftBlock[], value: unknown) {
  if (!Array.isArray(value)) return defaultWebsiteSectionOrder(pageKey, blocks);
  const expected = new Set([
    ...coreSectionsByPage[pageKey].map((section) => `core:${section.key}`),
    ...blocks.map((block) => `block:${block.id}`),
  ]);
  const order = value.filter((item): item is string => typeof item === 'string');
  if (order.length !== expected.size || new Set(order).size !== order.length || order.some((item) => !expected.has(item))) {
    return 'Every page section must appear exactly once in the layout.';
  }
  return order;
}

async function saveVersion(pageKey: WebsitePageKey, blocks: WebsiteDraftBlock[], sectionOrder: string[]) {
  const context = await authorizeWebsiteChange();
  if (!context.ok) return context;
  const { supabase, user } = context;
  const pageOption = websitePageOptions.find((item) => item.key === pageKey);
  if (!pageOption) return { ok: false, error: 'Choose a supported website page.' } as const;
  const { data: page, error: pageError } = await supabase.from('site_pages').select('id').eq('slug', pageOption.slug).maybeSingle();
  if (pageError || !page) return { ok: false, error: 'The website page is not ready. Refresh the workspace and try again.' } as const;
  const { data: versions, error: versionsError } = await supabase.from('site_page_versions').select('version_number').eq('page_id', page.id).eq('change_note', 'workspace_draft').order('version_number', { ascending: false }).limit(1);
  if (versionsError) return { ok: false, error: 'Could not load the current draft version. Try again.' } as const;
  const versionNumber = Number(versions?.[0]?.version_number ?? 0) + 1;
  const snapshot: WebsiteLayoutSnapshot = { blocks, section_order: sectionOrder };
  const { error } = await supabase.from('site_page_versions').insert({ page_id: page.id, version_number: versionNumber, snapshot, change_note: 'workspace_draft', created_by: user.id });
  if (error) return { ok: false, error: 'The website draft could not be saved. Check your connection and try again.' } as const;
  return { ok: true, supabase, user, page, snapshot } as const;
}

export async function saveWebsiteDraft(pageKey: WebsitePageKey, payload: unknown): Promise<WebsiteActionResult> {
  if (!['home', 'stores', 'product'].includes(pageKey)) return { ok: false, error: 'Choose a supported website page.' };
  const request = Array.isArray(payload) ? { blocks: payload, section_order: undefined } : payload && typeof payload === 'object' ? payload as { blocks?: unknown; section_order?: unknown } : {};
  const blocks = normalizeBlocks(pageKey, request.blocks);
  if (typeof blocks === 'string') return { ok: false, error: blocks };
  const sectionOrder = normalizeOrder(pageKey, blocks, request.section_order);
  if (typeof sectionOrder === 'string') return { ok: false, error: sectionOrder };
  const saved = await saveVersion(pageKey, blocks, sectionOrder);
  if (!saved.ok) return { ok: false, error: saved.error };
  await saved.supabase.from('audit_events').insert({ actor_id: saved.user.id, event_type: 'website_layout_draft_saved', entity_type: 'site_page', entity_id: saved.page.id, source: 'admin_website_workspace', metadata: { page: pageKey, sections: sectionOrder.length } });
  revalidatePath('/admin/workspace/website');
  return { ok: true, message: 'Draft saved. Customers still see the currently published page.' };
}

export async function publishWebsiteLayout(pageKey: WebsitePageKey, payload: unknown): Promise<WebsiteActionResult> {
  if (!['home', 'stores', 'product'].includes(pageKey)) return { ok: false, error: 'Choose a supported website page.' };
  const request = Array.isArray(payload) ? { blocks: payload, section_order: undefined } : payload && typeof payload === 'object' ? payload as { blocks?: unknown; section_order?: unknown } : {};
  const blocks = normalizeBlocks(pageKey, request.blocks);
  if (typeof blocks === 'string') return { ok: false, error: blocks };
  const sectionOrder = normalizeOrder(pageKey, blocks, request.section_order);
  if (typeof sectionOrder === 'string') return { ok: false, error: sectionOrder };
  const saved = await saveVersion(pageKey, blocks, sectionOrder);
  if (!saved.ok) return { ok: false, error: saved.error };
  const publishedAt = new Date().toISOString();
  const { error } = await saved.supabase.from('site_pages').update({
    status: 'published',
    published_layout: saved.snapshot,
    layout_published_at: publishedAt,
    published_at: publishedAt,
    approved_at: publishedAt,
    approved_by: saved.user.id,
    updated_at: publishedAt,
  }).eq('id', saved.page.id).select('id').maybeSingle();
  if (error) return { ok: false, error: 'Your draft was saved, but publishing did not complete. The customer page has not been changed.' };
  await saved.supabase.from('audit_events').insert({ actor_id: saved.user.id, event_type: 'website_layout_published', entity_type: 'site_page', entity_id: saved.page.id, source: 'admin_website_workspace', metadata: { page: pageKey, sections: sectionOrder.length } });
  revalidatePath('/');
  revalidatePath('/store/[slug]', 'page');
  revalidatePath('/product/[slug]', 'page');
  revalidatePath('/admin/workspace/website');
  return { ok: true, message: 'Published. The customer page now shows this layout.' };
}
