import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySimpleCaptcha } from '@/lib/security/simple-captcha';
import { normalizeIndiaPhone } from '@/lib/phone-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  if (process.env.PHONE_OTP_ENABLED !== 'true') return json({ error: 'Mobile sign-in is not enabled yet.' }, 503);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Request could not be verified.' }, 403);
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 8_192) return json({ error: 'Request is too large.' }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_192) return json({ error: 'Request is too large.' }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Invalid request.' }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const phone = normalizeIndiaPhone(body.phone);
  const mode = body.mode === 'signup' ? 'signup' : body.mode === 'signin' ? 'signin' : null;
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const referralCode = typeof body.referralCode === 'string' ? body.referralCode.trim().toUpperCase() : '';
  if (!phone || !mode) return json({ error: 'Enter a valid Indian mobile number.' }, 400);
  if (mode === 'signup' && (displayName.length < 2 || displayName.length > 100)) return json({ error: 'Enter your name to create an account.' }, 400);
  if (referralCode && !/^GLONNI-[A-Z0-9]{8}$/.test(referralCode)) return json({ error: 'This referral link is invalid.' }, 400);
  if (!verifySimpleCaptcha(String(body.captchaToken ?? ''), String(body.captchaAnswer ?? ''))) return json({ error: 'Complete the security check and try again.' }, 400);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: mode === 'signup',
      ...(mode === 'signup' ? { data: { display_name: displayName, ...(referralCode ? { referral_code: referralCode } : {}) } } : {}),
    },
  });
  if (error?.status === 429) return json({ error: 'Too many code requests. Please wait before trying again.' }, 429);
  if (error) return json({ error: 'We could not send a code. Check the number and try again later.' }, 502);
  return json({ ok: true });
}
