'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const destination = '/admin/finance-tax';
const treatments = new Set(['unclassified','taxable','exempt','nil_rated','zero_rated','outside_scope','reverse_charge','other']);
const areas = new Set(['affiliate_commission','voucher_sale','bill_payment','cashback','gateway_fee','operating_expense','other']);
const modes = new Set(['not_set','cgst_sgst','igst','manual']);

async function requireFinanceAdmin() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') redirect('/admin/login?next=/admin/finance-tax');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner','admin'].includes(profile.role) || employee?.status !== 'active') {
    redirect('/admin/login?next=/admin/finance-tax');
  }
  return { supabase, user };
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}
function optional(value: string) { return value || null; }
function keyFrom(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export async function saveTaxBusinessProfile(formData: FormData) {
  const { supabase, user } = await requireFinanceAdmin();
  const legalName = value(formData, 'legalName');
  const status = value(formData, 'gstRegistrationStatus');
  const allowed = new Set(['unconfirmed','unregistered','regular','composition','other']);
  if (legalName.length < 2 || legalName.length > 200 || !allowed.has(status)) redirect(`${destination}?notice=invalid_business`);

  const payload = {
    singleton_id: 1,
    legal_name: legalName,
    trade_name: optional(value(formData, 'tradeName')),
    pan: optional(value(formData, 'pan').toUpperCase()),
    gstin: optional(value(formData, 'gstin').toUpperCase()),
    gst_registration_status: status,
    registered_address: optional(value(formData, 'registeredAddress')),
    state_name: optional(value(formData, 'stateName')),
    state_code: optional(value(formData, 'stateCode')),
    contact_email: optional(value(formData, 'contactEmail')),
    updated_by: user.id,
  };
  const { error } = await supabase.from('tax_business_profiles').upsert(payload, { onConflict: 'singleton_id' });
  if (error) redirect(`${destination}?notice=business_failed`);
  revalidatePath(destination);
  redirect(`${destination}?notice=business_saved`);
}

export async function createTaxCodeVersion(formData: FormData) {
  const { supabase, user } = await requireFinanceAdmin();
  const displayName = value(formData, 'displayName');
  const codeKey = keyFrom(value(formData, 'codeKey') || displayName);
  const supplyArea = value(formData, 'supplyArea');
  const treatment = value(formData, 'gstTreatment');
  const mode = value(formData, 'taxComponentMode');
  const rateText = value(formData, 'ratePercent');
  const rate = rateText ? Number(rateText) : null;
  const effectiveFrom = value(formData, 'effectiveFrom');
  const effectiveTo = value(formData, 'effectiveTo');
  const status = value(formData, 'status') === 'approved' ? 'approved' : 'draft';
  const adviserName = value(formData, 'adviserName');
  const approvalReference = value(formData, 'approvalReference');

  if (displayName.length < 2 || displayName.length > 140 || codeKey.length < 2 ||
      !areas.has(supplyArea) || !treatments.has(treatment) || !modes.has(mode) ||
      (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) ||
      (effectiveTo && (!effectiveFrom || effectiveTo < effectiveFrom)) ||
      (status === 'approved' && (rate === null || !effectiveFrom || treatment === 'unclassified' || !adviserName || !approvalReference))) {
    redirect(`${destination}?notice=invalid_tax_code`);
  }

  const { data: previous, error: lookupError } = await supabase.from('tax_code_versions')
    .select('version').eq('code_key', codeKey).order('version', { ascending: false }).limit(1).maybeSingle();
  if (lookupError) redirect(`${destination}?notice=tax_code_failed`);
  const version = Number(previous?.version ?? 0) + 1;
  const { error } = await supabase.from('tax_code_versions').insert({
    code_key: codeKey,
    version,
    display_name: displayName,
    supply_area: supplyArea,
    gst_treatment: treatment,
    rate_percent: rate,
    hsn_sac: optional(value(formData, 'hsnSac')),
    tax_component_mode: mode,
    effective_from: optional(effectiveFrom),
    effective_to: optional(effectiveTo),
    status,
    adviser_name: status === 'approved' ? adviserName : null,
    approval_reference: status === 'approved' ? approvalReference : null,
    approved_at: status === 'approved' ? new Date().toISOString() : null,
    approved_by: status === 'approved' ? user.id : null,
    created_by: user.id,
  });
  if (error) redirect(`${destination}?notice=tax_code_failed`);
  revalidatePath(destination);
  redirect(`${destination}?notice=tax_code_saved`);
}
