'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function operator() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user) redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2')
    throw new Error('An active Owner or Admin with 2FA is required.');
  return { supabase, user };
}

export async function matchConversion(formData: FormData) {
  const { supabase, user } = await operator();
  const conversionId = String(formData.get('conversionId') ?? '');
  const clickToken = String(formData.get('clickToken') ?? '').trim();
  if (!conversionId || !clickToken) throw new Error('Conversion and click ID are required.');
  const [{ data: conversion }, { data: click }] = await Promise.all([
    supabase.from('referral_conversions').select('id,provider_id').eq('id', conversionId).single(),
    supabase.from('redirect_events').select('id,profile_id,offer_id,merchant_id,provider_id,click_token,reward_type_snapshot,cashback_fixed_snapshot,cashback_percent_snapshot,cashback_cap_snapshot,reward_funding_source_snapshot,cashback_tracking_supported_snapshot,commission_rate_snapshot,commission_fixed_snapshot,cashback_confirmation_days_snapshot').eq('click_token', clickToken).single(),
  ]);
  if (!conversion || !click || conversion.provider_id !== click.provider_id) throw new Error('The click must belong to the same affiliate provider.');
  const { error } = await supabase.from('referral_conversions').update({
    redirect_event_id: click.id, profile_id: click.profile_id, offer_id: click.offer_id,
    merchant_id: click.merchant_id, provider_click_reference: click.click_token,
    reward_type_snapshot: click.reward_type_snapshot, cashback_fixed_snapshot: click.cashback_fixed_snapshot,
    cashback_percent_snapshot: click.cashback_percent_snapshot, cashback_cap_snapshot: click.cashback_cap_snapshot,
    reward_funding_source_snapshot: click.reward_funding_source_snapshot, commission_rate_snapshot: click.commission_rate_snapshot,
    cashback_tracking_supported_snapshot: click.cashback_tracking_supported_snapshot,
    commission_fixed_snapshot: click.commission_fixed_snapshot,
    cashback_confirmation_days_snapshot: click.cashback_confirmation_days_snapshot,
    match_status: 'matched', match_method: 'manual_admin', issue_code: null,
    reviewed_at: new Date().toISOString(), reviewed_by: user.id,
  }).eq('id', conversionId);
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'conversion_manually_matched', entity_type: 'referral_conversion', entity_id: conversionId, source: 'admin', metadata: { click_token: clickToken } });
  revalidatePath('/admin/orders');
  redirect('/admin/orders?success=Conversion%20matched%20to%20the%20tracked%20click');
}

export async function rejectConversion(formData: FormData) {
  const { supabase, user } = await operator();
  const conversionId = String(formData.get('conversionId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 240);
  if (!conversionId || !reason) throw new Error('A rejection reason is required.');
  const { error } = await supabase.from('referral_conversions').update({ status: 'rejected', match_status: 'rejected', issue_code: reason, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq('id', conversionId);
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'conversion_rejected', entity_type: 'referral_conversion', entity_id: conversionId, source: 'admin', metadata: { reason } });
  revalidatePath('/admin/orders');
}
