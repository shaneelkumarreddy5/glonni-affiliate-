'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const outstandingStatuses = ['requested', 'on_hold', 'approved'];

export async function requestWithdrawal(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wallet');

  const amount = Number(formData.get('amount'));
  const upiId = String(formData.get('upiId') ?? '').trim();
  if (!Number.isFinite(amount) || amount < 100 || !upiId.includes('@') || upiId.length > 100) {
    redirect('/wallet?error=Enter+an+amount+of+at+least+%E2%82%B9100+and+a+valid+UPI+ID.');
  }

  const [{ data: entries }, { data: requests }] = await Promise.all([
    supabase.from('wallet_entries').select('amount,entry_type'),
    supabase.from('withdrawal_requests').select('amount,status'),
  ]);
  const ledgerBalance = (entries ?? []).reduce((total, entry) => total + Number(entry.amount), 0);
  const reservedAmount = (requests ?? []).filter((request) => outstandingStatuses.includes(request.status)).reduce((total, request) => total + Number(request.amount), 0);
  const availableAmount = Math.max(0, ledgerBalance - reservedAmount);
  if (amount > availableAmount) redirect('/wallet?error=The+requested+amount+is+greater+than+your+available+confirmed+cashback.');

  const { error } = await supabase.from('withdrawal_requests').insert({ profile_id: user.id, amount, upi_id: upiId });
  if (error) redirect('/wallet?error=Your+withdrawal+request+could+not+be+submitted.+Please+try+again.');

  revalidatePath('/wallet');
  revalidatePath('/admin/wallet');
  redirect('/wallet?success=Your+withdrawal+request+has+been+sent+for+manual+review.');
}
