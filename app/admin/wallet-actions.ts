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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['owner', 'admin'].includes(profile.role)) throw new Error('Owner or Admin access required');

  const id = String(formData.get('id'));
  const decision = String(formData.get('decision'));
  const amount = Number(formData.get('amount'));
  if (!['confirm', 'hold', 'reject'].includes(decision)) throw new Error('Invalid claim decision');

  const { data: claim, error } = await supabase
    .from('cashback_claims')
    .select('profile_id,status')
    .eq('id', id)
    .single();
  if (error || !claim) throw new Error('Claim not found');
  if (!['submitted', 'needs_info'].includes(claim.status)) throw new Error('This claim has already been reviewed');

  const status = decision === 'confirm' ? 'confirmed' : decision === 'hold' ? 'needs_info' : 'rejected';
  const { error: updateError } = await supabase
    .from('cashback_claims')
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', claim.status);
  if (updateError) throw new Error('Unable to update this claim');

  if (decision === 'confirm' && Number.isFinite(amount) && amount > 0) {
    const { error: ledgerError } = await supabase.from('wallet_entries').insert({
      profile_id: claim.profile_id,
      claim_id: id,
      entry_type: 'cashback_confirmed',
      amount,
      created_by: user.id,
      note: 'Admin-confirmed cashback',
    });
    if (ledgerError) throw new Error('Claim was confirmed but the ledger credit could not be recorded');
  }

  refresh();
}
