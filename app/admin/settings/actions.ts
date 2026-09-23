'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type SettingsSaveResult = { ok: true } | { ok: false; error: string };
export type SettingsPayload = {
  site_name: string; logo_url: string; default_language: string;
  global_rules: string;
  work_controls: { product_intake: boolean; scheduled_promotions: boolean; nonessential_notifications: boolean; ai_workflows: boolean; pause_all: boolean };
  require_admin_approval: boolean;
};

export async function saveGlobalSettings(payload: SettingsPayload): Promise<SettingsSaveResult> {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') return { ok: false, error: 'Sign in as an Owner or Admin and complete two-step verification to change global settings.' };
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active') return { ok: false, error: 'An active Owner or Admin with verified two-step authentication is required.' };

  const siteName = payload.site_name.trim();
  const logoUrl = payload.logo_url.trim();
  const language = payload.default_language.trim();
  const globalRules = payload.global_rules.trim();
  if (siteName.length < 2 || siteName.length > 80) return { ok: false, error: 'Site name must be between 2 and 80 characters.' };
  if (logoUrl && (!logoUrl.startsWith('https://') || logoUrl.length > 500)) return { ok: false, error: 'Logo URL must be a valid HTTPS address.' };
  if (!['en-IN', 'en-US'].includes(language)) return { ok: false, error: 'Choose a supported language.' };
  if (globalRules.length > 5000) return { ok: false, error: 'Global rules are limited to 5,000 characters.' };
  if (!payload.require_admin_approval) return { ok: false, error: 'Admin approval is a required publishing safeguard and cannot be disabled globally.' };

  const now = new Date().toISOString();
  const next: SettingsPayload = {
    ...payload,
    site_name: siteName,
    logo_url: logoUrl,
    default_language: language,
    global_rules: globalRules,
    work_controls: {
      product_intake: Boolean(payload.work_controls?.product_intake),
      scheduled_promotions: Boolean(payload.work_controls?.scheduled_promotions),
      nonessential_notifications: Boolean(payload.work_controls?.nonessential_notifications),
      ai_workflows: Boolean(payload.work_controls?.ai_workflows),
      pause_all: Boolean(payload.work_controls?.pause_all),
    },
    require_admin_approval: Boolean(payload.require_admin_approval),
  };
  // Return a column explicitly granted to the public identity reader role.
  const { data: identitySaved, error: identityError } = await supabase.from('website_identity').update({ site_name: siteName, logo_url: logoUrl, default_language: language, updated_by: user.id, updated_at: now }).eq('id', 1).select('site_name').maybeSingle();
  if (identityError || !identitySaved) return { ok: false, error: 'Website identity could not be saved. Verify the database migration and admin permissions.' };
  const { data: settingsSaved, error } = await supabase.from('platform_settings').update({ global_rules: globalRules, work_controls: next.work_controls, require_admin_approval: next.require_admin_approval, updated_by: user.id, updated_at: now }).eq('id', 1).select('id').maybeSingle();
  if (error || !settingsSaved) return { ok: false, error: 'Global rules and work controls could not be saved. Verify the database migration and admin permissions.' };
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'global_settings_updated', entity_type: 'platform_settings', entity_id: null, source: 'admin_settings', metadata: { changed_sections: ['identity', 'global_rules', 'work_controls', 'safety'] } });
  revalidatePath('/admin/settings');
  revalidatePath('/');
  revalidatePath('/admin/ai-agents');
  revalidatePath('/admin/products');
  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/notifications');
  return { ok: true };
}
