'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function financeAdmin() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') throw new Error('Active finance admin with 2FA required.');
  return { supabase, user };
}

export async function configurePointsOffer(formData: FormData) {
  const { supabase, user } = await financeAdmin();
  const offerId = String(formData.get('offerId') ?? '');
  const points = Number(formData.get('points'));
  const days = Number(formData.get('confirmationDays'));
  const terms = String(formData.get('terms') ?? '').trim();
  const fundingSource = String(formData.get('fundingSource') ?? '');
  if (!Number.isInteger(points) || points <= 0 || !Number.isInteger(days) || days < 0 || days > 365 || terms.length < 20 || !['glonni', 'merchant', 'provider'].includes(fundingSource)) throw new Error('Enter valid points, confirmation days, funding source, and approved reward terms.');
  const { data: offer } = await supabase.from('offers').select('id,status').eq('id', offerId).single();
  if (!offer || offer.status !== 'draft') throw new Error('Only draft offers can be configured as points offers.');
  const { error } = await supabase.from('offers').update({ reward_type: 'points', reward_points: points, cashback_amount: null, cashback_percent: null, cashback_cap: null, cashback_tracking_supported: false, reward_funding_source: fundingSource, reward_terms: terms, cashback_confirmation_days: days, review_status: 'draft' }).eq('id', offerId);
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'offer_reward_points_configured', entity_type: 'offer', entity_id: offerId, source: 'admin', metadata: { points, confirmation_days: days, funding_source: fundingSource } });
  revalidatePath('/admin/offers');
  revalidatePath('/admin/reward-points');
  redirect('/admin/reward-points?success=Points+rule+saved+on+the+draft+offer');
}

export async function issuePointAward(formData: FormData) {
  const { supabase } = await financeAdmin();
  const id = String(formData.get('conversionId') ?? '');
  const { error } = await supabase.rpc('issue_reward_point_award', { p_conversion_id: id });
  if (error) throw new Error(error.message);
  revalidatePath('/wallet');
  revalidatePath('/admin/reward-points');
  redirect('/admin/reward-points?success=Points+award+created+pending+confirmation');
}

export async function decidePointAward(formData: FormData) {
  const { supabase } = await financeAdmin();
  const id = String(formData.get('awardId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const { error } = await supabase.rpc('decide_reward_point_award', { p_award_id: id, p_decision: decision, p_note: note || null });
  if (error) throw new Error(error.message);
  revalidatePath('/wallet');
  revalidatePath('/admin/reward-points');
  redirect('/admin/reward-points?success=Reward+award+updated');
}
