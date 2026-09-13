'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function operator() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user) redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') {
    throw new Error('An active Owner or Admin with 2FA is required.');
  }
  return { supabase, user };
}

function refresh() {
  revalidatePath('/admin/payout-operations');
  revalidatePath('/admin/wallet');
  revalidatePath('/wallet');
}

export async function setPayoutVerification(formData: FormData) {
  const { supabase, user } = await operator();
  const profileId = String(formData.get('profileId') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 120);
  const { error } = await supabase.rpc('set_payout_verification', { p_profile_id: profileId, p_status: status, p_note: note || null, p_reference: reference || null });
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: `payout_verification_${status}`, entity_type: 'profile', entity_id: profileId, source: 'admin', metadata: { note: note || null, reference: reference || null } });
  refresh();
}

export async function decideWithdrawal(formData: FormData) {
  const { supabase, user } = await operator();
  const withdrawalId = String(formData.get('withdrawalId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const { error } = await supabase.rpc('decide_withdrawal', { p_withdrawal_id: withdrawalId, p_decision: decision, p_note: note || null });
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: `withdrawal_${decision}`, entity_type: 'withdrawal_request', entity_id: withdrawalId, source: 'admin', metadata: { note: note || null } });
  refresh();
}

export async function createPayoutBatch(formData: FormData) {
  const { supabase, user } = await operator();
  const withdrawalIds = formData.getAll('withdrawalId').map(String).filter(Boolean);
  const providerKey = String(formData.get('providerKey') ?? '').trim().slice(0, 80);
  if (!withdrawalIds.length) throw new Error('Select at least one approved withdrawal.');
  const { data, error } = await supabase.rpc('create_payout_batch', { p_withdrawal_ids: withdrawalIds, p_provider_key: providerKey || null });
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'payout_batch_created', entity_type: 'payout_batch', entity_id: data, source: 'admin', metadata: { withdrawal_count: withdrawalIds.length, provider_key: providerKey || null } });
  refresh();
}

export async function recordPayoutResult(formData: FormData) {
  const { supabase, user } = await operator();
  const payoutItemId = String(formData.get('payoutItemId') ?? '');
  const result = String(formData.get('result') ?? '');
  const providerReference = String(formData.get('providerReference') ?? '').trim().slice(0, 160);
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const { error } = await supabase.rpc('record_payout_result', { p_payout_item_id: payoutItemId, p_result: result, p_provider_reference: providerReference || null, p_note: note || null });
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: `payout_${result}`, entity_type: 'payout_item', entity_id: payoutItemId, source: 'admin', metadata: { provider_reference: providerReference || null, note: note || null } });
  refresh();
}
