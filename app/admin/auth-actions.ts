'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const msg = (value: string) => encodeURIComponent(value);
const safeNext = (value: FormDataEntryValue | null) => {
  const path = String(value ?? '/admin/dashboard');
  return path.startsWith('/admin') && !path.startsWith('//') ? path : '/admin/dashboard';
};

export async function adminSignIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/admin/login?error=${msg('Email or password is incorrect.')}&next=${encodeURIComponent(next)}`);
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user!.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user!.id).single(),
  ]);
  if (!profile || !['owner','admin','editor'].includes(profile.role) || !employee || !['active','invited'].includes(employee.status)) {
    await supabase.auth.signOut();
    redirect(`/admin/login?error=${msg('This account is not authorized for the admin panel.')}`);
  }
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === 'aal2') redirect(next);
  redirect(`${assurance?.nextLevel === 'aal2' ? '/admin/mfa/challenge' : '/admin/mfa/enroll'}?next=${encodeURIComponent(next)}`);
}

export async function completeAdminOnboarding(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password.length < 12) redirect(`/admin/onboarding?error=${msg('Use a strong password with at least 12 characters.')}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/admin/onboarding?error=${msg('The invitation is invalid or expired. Request a new invitation.')}`);
  redirect('/admin/mfa/enroll?next=/admin/dashboard');
}

export async function adminUpdatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password.length < 12) redirect(`/admin/reset-password?error=${msg('Use at least 12 characters.')}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/admin/reset-password?error=${msg('The reset link is invalid or expired.')}`);
  await supabase.auth.signOut();
  redirect(`/admin/login?success=${msg('Password updated. Sign in and complete 2FA.')}`);
}

export async function adminSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
