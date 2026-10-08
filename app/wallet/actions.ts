'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifySimpleCaptcha } from '@/lib/security/simple-captcha';
import { allPages } from '@/lib/supabase/paginate';

const outstandingStatuses = ['requested', 'on_hold', 'approved', 'batched', 'processing'];

export async function requestWithdrawal(formData: FormData) {
  const returnToAccount = formData.get('returnTo') === 'account';
  const walletPath = returnToAccount ? '/account?section=wallet' : '/wallet';
  const messageUrl = (kind: 'error' | 'success', text: string) => `${walletPath}${returnToAccount ? '&' : '?'}${kind}=${encodeURIComponent(text)}`;
  const fail = (text: string): never => redirect(messageUrl('error', text));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(walletPath)}`);
  if (!verifySimpleCaptcha(String(formData.get('captchaToken') ?? ''), String(formData.get('captchaAnswer') ?? ''))) fail('Please complete the quick security check and try again.');

  const amount = Number(formData.get('amount'));
  const upiId = String(formData.get('upiId') ?? '').trim();
  if (!Number.isFinite(amount) || amount < 100 || !upiId.includes('@') || upiId.length > 100) fail('Enter an amount of at least ₹100 and a valid UPI ID.');

  const [entries, requests] = await Promise.all([
    allPages((from, to) => supabase.from('wallet_entries').select('amount,entry_type').order('created_at').range(from, to)),
    allPages((from, to) => supabase.from('withdrawal_requests').select('amount,status').order('created_at').range(from, to)),
  ]);
  if (entries.error || requests.error) fail('Your balance could not be verified. Please try again.');
  const ledgerBalance = entries.data.reduce((total, entry) => total + Number(entry.amount), 0);
  const reservedAmount = requests.data.filter((request) => outstandingStatuses.includes(request.status)).reduce((total, request) => total + Number(request.amount), 0);
  const availableAmount = Math.max(0, ledgerBalance - reservedAmount);
  if (amount > availableAmount) fail('The requested amount is greater than your available confirmed cashback.');

  const { error } = await supabase.from('withdrawal_requests').insert({ profile_id: user.id, amount, upi_id: upiId });
  if (error) fail('Your withdrawal request could not be submitted. Please try again.');

  revalidatePath('/wallet');
  revalidatePath('/account');
  revalidatePath('/admin/wallet');
  redirect(messageUrl('success', 'Your withdrawal request has been sent for manual review.'));
}
