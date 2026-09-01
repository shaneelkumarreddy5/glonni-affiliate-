'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const refresh = () => {
  revalidatePath('/admin/wallet');
  revalidatePath('/account');
  revalidatePath('/cashback-claim');
};

export async function reviewCashbackClaim(formData: FormData) {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) throw new Error('Sign in required');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['owner', 'admin'].includes(profile.role) || assurance?.currentLevel !== 'aal2') throw new Error('A verified Owner or Admin 2FA session is required');

  const id = String(formData.get('id'));
  const decision = String(formData.get('decision'));
  if (!['confirm', 'hold', 'reject'].includes(decision)) throw new Error('Invalid claim decision');

  const { data: claim, error } = await supabase
    .from('cashback_claims')
    .select('profile_id,status,conversion_id,risk_score')
    .eq('id', id)
    .single();
  if (error || !claim) throw new Error('Claim not found');
  if (!['submitted', 'needs_info'].includes(claim.status)) throw new Error('This claim has already been reviewed');

  if (decision === 'confirm' && (!claim.conversion_id || claim.risk_score >= 60)) throw new Error('Only a low-risk claim linked to a confirmed provider conversion can be confirmed.');
  const status = decision === 'confirm' ? 'confirmed' : decision === 'hold' ? 'needs_info' : 'rejected';
  const { error: updateError } = await supabase
    .from('cashback_claims')
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', claim.status);
  if (updateError) throw new Error('Unable to update this claim');

  refresh();
}
