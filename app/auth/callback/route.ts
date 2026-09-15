import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeCustomerReturnPath } from '@/lib/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const rawNext = url.searchParams.get('next') ?? '/account';
  const isAdminFlow = rawNext === '/admin' || rawNext.startsWith('/admin/');
  const next = isAdminFlow && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : safeCustomerReturnPath(rawNext);
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
  target.searchParams.set('error', isAdminFlow ? 'The invitation link is invalid or expired. Please request a new invitation.' : 'The verification link is invalid or expired. Please request a new email.');
  target.searchParams.set('next', next);
  return NextResponse.redirect(target);
}
