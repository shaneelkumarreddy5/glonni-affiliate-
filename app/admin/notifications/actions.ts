'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireNotificationAdmin() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect('/admin/login?next=/admin/notifications');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin', 'editor'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') throw new Error('An active admin with verified 2FA is required.');
  return { supabase, user };
}

const noticeUrl = (kind: 'success' | 'error', message: string) => `/admin/notifications?${kind}=${encodeURIComponent(message)}`;

export async function saveNotificationTemplate(formData: FormData) {
  const { supabase, user } = await requireNotificationAdmin();
  const id = String(formData.get('templateId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const status = String(formData.get('status') ?? 'draft');
  if (!id || name.length < 2 || name.length > 120 || subject.length < 2 || subject.length > 180 || body.length < 5 || body.length > 2000 || !['draft', 'active', 'paused'].includes(status)) redirect(noticeUrl('error', 'Review the template name, title, message, and status.'));
  const { error } = await supabase.from('notification_templates').update({ name, subject, body, status, updated_by: user.id, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) redirect(noticeUrl('error', 'The template could not be saved. Check its fields and try again.'));
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'notification_template_updated', entity_type: 'notification_template', entity_id: id, source: 'admin_notifications', metadata: { status } });
  revalidatePath('/admin/notifications');
  redirect(noticeUrl('success', 'Template saved. New matching source events will use this version.'));
}

export async function sendNotificationCampaign(formData: FormData) {
  const { supabase, user } = await requireNotificationAdmin();
  const templateId = String(formData.get('templateId') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const confirmSend = String(formData.get('confirmSend') ?? '');
  if (confirmSend !== 'yes') redirect(noticeUrl('error', 'Confirm the audience and message before sending.'));
  if (!templateId || subject.length < 2 || subject.length > 180 || body.length < 5 || body.length > 2000) redirect(noticeUrl('error', 'Select a template and provide a valid title and message.'));
  const { data: template } = await supabase.from('notification_templates').select('id,category,template_key,is_promotional,status').eq('id', templateId).single();
  if (!template || template.status !== 'active' || !['deals_offers', 'system_announcements'].includes(template.category)) redirect(noticeUrl('error', 'Campaigns can use only an active Deals or System Announcements template.'));
  const category = template.category as 'deals_offers' | 'system_announcements';
  const customerRows = []; const preferenceRows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('profiles').select('id').eq('role', 'customer').order('id').range(offset, offset + 999);
    if (error) redirect(noticeUrl('error', 'Could not confirm the customer audience. No notifications were sent.'));
    customerRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (category === 'deals_offers') {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('customer_preferences').select('profile_id').eq('marketing_updates', true).order('profile_id').range(offset, offset + 999);
      if (error) redirect(noticeUrl('error', 'Could not verify promotional preferences. No notifications were sent.'));
      preferenceRows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const optedIn = category === 'deals_offers' ? new Set(preferenceRows.map((row) => row.profile_id)) : null;
  const audience = customerRows.filter((customer) => !optedIn || optedIn.has(customer.id));
  if (!audience.length) redirect(noticeUrl('error', category === 'deals_offers' ? 'No customers are currently opted in to promotional updates.' : 'There are no customer accounts to notify.'));
  const campaignId = randomUUID();
  const rows = audience.map((customer) => ({ profile_id: customer.id, template_id: template.id, category, title: subject, body, source_table: 'admin_campaign', source_id: campaignId, event_key: template.template_key, metadata: { sent_by: user.id, template_key: template.template_key } }));
  for (let offset = 0; offset < rows.length; offset += 250) {
    const { error } = await supabase.from('customer_notifications').insert(rows.slice(offset, offset + 250));
    if (error) redirect(noticeUrl('error', `Campaign stopped while saving delivery records (${offset} of ${rows.length}). Review delivery history before retrying.`));
  }
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'notification_campaign_sent', entity_type: 'notification_campaign', entity_id: campaignId, source: 'admin_notifications', metadata: { category, template_key: template.template_key, recipient_count: audience.length, channel: 'in_app' } });
  revalidatePath('/admin/notifications');
  redirect(noticeUrl('success', `In-app notification sent to ${audience.length} ${category === 'deals_offers' ? 'opted-in customers' : 'customers'}.`));
}
