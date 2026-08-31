'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createRecoveryRequestClient } from '@/lib/supabase/recovery';

const safeNext = (value: FormDataEntryValue | null, fallback = '/account') => {
  const path = typeof value === 'string' ? value : fallback;
  return path.startsWith('/') && !path.startsWith('//') ? path : fallback;
};

const message = (value: string) => encodeURIComponent(value);

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = h.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?mode=signin&next=${encodeURIComponent(next)}&error=${message('Email or password is incorrect, or the email has not been verified.')}`);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const displayName = String(formData.get('displayName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  if (displayName.length < 2 || password.length < 8) redirect(`/login?mode=signup&next=${encodeURIComponent(next)}&error=${message('Enter your name and use a password with at least 8 characters.')}`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/login?mode=signup&next=${encodeURIComponent(next)}&error=${message(error.message)}`);
  if (data.session) redirect(next);
  redirect(`/login?mode=signin&success=${message('Account created. Check your email and confirm your address before signing in.')}`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const supabase = createRecoveryRequestClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/recovery?audience=customer` });
  if (error?.status === 429) redirect(`/forgot-password?error=${message('Too many recovery emails were requested. Supabase has temporarily limited delivery; please wait before trying again.')}`);
  if (error) redirect(`/forgot-password?error=${message('We could not send a recovery email. Please try again later.')}`);
  redirect(`/forgot-password?success=${message('If an account exists, a five-minute recovery link has been sent. Open only the newest email.')}`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) redirect(`/reset-password?error=${message('Use a password with at least 8 characters.')}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${message('This reset link is invalid or expired. Please request a new one.')}`);
  await supabase.auth.signOut();
  redirect(`/login?success=${message('Password updated. Sign in with your new password.')}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
