'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BILL_SERVICES, CommerceSectionKey, normalizeCommerceVisibility, VOUCHER_CATEGORIES } from '@/lib/commerce';
import { createClient } from '@/lib/supabase/server';

const adminTabs = new Set(['overview', 'coupons', 'vouchers', 'bills', 'providers', 'transactions']);
const sectionFields: Record<CommerceSectionKey, string> = {
  coupons: 'coupons_enabled',
  buy_coupons: 'buy_coupons_enabled',
  bill_payments: 'bill_payments_enabled',
};

export async function setCommerceVisibility(formData: FormData) {
  const tab = String(formData.get('returnTab') ?? 'overview');
  const returnTab = adminTabs.has(tab) ? tab : 'overview';
  const destination = `/admin/vouchers-bills?tab=${returnTab}`;
  const scope = String(formData.get('scope') ?? '');
  const key = String(formData.get('key') ?? '');
  const enabled = formData.get('enabled') === 'true';
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') redirect(`${destination}&notice=denied`);
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active') redirect(`${destination}&notice=denied`);

  const { data, error } = await supabase.from('commerce_visibility')
    .select('coupons_enabled,buy_coupons_enabled,bill_payments_enabled,bill_services,voucher_categories')
    .eq('id', 1).maybeSingle();
  if (error || !data) redirect(`${destination}&notice=unavailable`);
  const current = normalizeCommerceVisibility(data);
  let patch: Record<string, unknown>;
  if (scope === 'section' && Object.hasOwn(sectionFields, key)) {
    patch = { [sectionFields[key as CommerceSectionKey]]: enabled };
  } else if (scope === 'bill' && BILL_SERVICES.some((item) => item.key === key)) {
    patch = { bill_services: { ...current.bill_services, [key]: enabled } };
  } else if (scope === 'voucher' && VOUCHER_CATEGORIES.some((item) => item.key === key)) {
    patch = { voucher_categories: { ...current.voucher_categories, [key]: enabled } };
  } else {
    redirect(`${destination}&notice=invalid`);
  }
  const { data: saved, error: saveError } = await supabase.from('commerce_visibility')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1).select('id').maybeSingle();
  if (saveError || !saved) redirect(`${destination}&notice=failed`);
  await supabase.from('audit_events').insert({
    actor_id: user.id, event_type: 'commerce_visibility_updated', entity_type: 'commerce_visibility',
    entity_id: null, source: 'admin_vouchers_bills', metadata: { scope, key, enabled },
  });
  revalidatePath('/admin/vouchers-bills');
  revalidatePath('/vouchers-bills');
  redirect(`${destination}&notice=saved`);
}
