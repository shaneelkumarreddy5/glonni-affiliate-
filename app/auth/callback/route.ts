import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const rawNext = url.searchParams.get('next') ?? '/account';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account';
  const isAdminFlow = next === '/admin' || next.startsWith('/admin/');
  const errorTarget = isAdminFlow ? '/admin/login' : '/login';
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const target = new URL(errorTarget, url.origin);
  target.searchParams.set('error', 'The verification link is invalid or expired. Please request a new invitation.');
  if (isAdminFlow) target.searchParams.set('next', next);
  return NextResponse.redirect(target);
}
