'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function submitCashbackClaim(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/cashback-claim');

  const orderReference = String(formData.get('orderReference') ?? '').trim();
  const purchaseAmount = Number(formData.get('purchaseAmount'));
  const claimedAmount = Number(formData.get('claimedAmount'));
  const offerId = String(formData.get('offerId') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (orderReference.length < 3 || !Number.isFinite(purchaseAmount) || purchaseAmount <= 0 || !Number.isFinite(claimedAmount) || claimedAmount <= 0) {
    redirect('/cashback-claim?error=Please+complete+the+order+and+cashback+details.');
  }

  const { error } = await supabase.from('cashback_claims').insert({ profile_id: user.id, offer_id: offerId, order_reference: orderReference, purchase_amount: purchaseAmount, claimed_amount: claimedAmount, note });
  if (error) redirect('/cashback-claim?error=Your+claim+could+not+be+submitted.+Please+try+again.');

  revalidatePath('/account');
  revalidatePath('/admin/wallet');
  redirect('/cashback-claim?success=Your+claim+has+been+submitted+for+review.');
}
