'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizeIndiaPhone } from '@/lib/phone-auth';

type Props = { enabled: boolean; mode: 'signin' | 'signup'; next: string; referralCode: string };
type Challenge = { question: string; token: string };

export function PhoneOtpForm({ enabled, mode, next, referralCode }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function refreshChallenge() {
    setChallenge(null);
    setAnswer('');
    try {
      const response = await fetch('/api/captcha', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setChallenge(await response.json() as Challenge);
    } catch {
      setError('The security check is unavailable. Please refresh and try again.');
    }
  }

  useEffect(() => {
    if (enabled) void refreshChallenge();
  }, [enabled]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/auth/phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          displayName,
          mode,
          referralCode,
          captchaToken: challenge?.token,
          captchaAnswer: answer,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'We could not request a code. Please try again later.');
      setStage('verify');
      setCode('');
      setNotice(mode === 'signin'
        ? 'If this number has a Glonni account, a verification code has been sent.'
        : 'If the number can be registered, a verification code has been sent.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not request a code. Please try again later.');
      await refreshChallenge();
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError('');
    try {
      const { error: verifyError } = await createClient().auth.verifyOtp({
        phone: normalizeIndiaPhone(phone),
        token: code,
        type: 'sms',
      });
      if (verifyError) throw new Error();
      router.replace(next);
      router.refresh();
    } catch {
      setError('That code is incorrect or expired. Request a new code and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <section className="phone-otp-pending" aria-label="Mobile sign-in setup">
    <h2>Mobile OTP</h2>
    <p>Mobile sign-in is being prepared. Email sign-in remains available.</p>
  </section>;

  const normalized = normalizeIndiaPhone(phone);
  return <section className="phone-otp-section" aria-label="Mobile OTP sign-in">
    <h2>{mode === 'signup' ? 'Create account with mobile' : 'Sign in with mobile'}</h2>
    {error && <p className="auth-notice error" role="alert">{error}</p>}
    {notice && <p className="auth-notice success" role="status">{notice}</p>}
    {stage === 'request' ? <form className="auth-form" onSubmit={requestCode}>
      {mode === 'signup' && <label>Full name<input autoComplete="name" minLength={2} maxLength={100} required value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name"/></label>}
      <label>India mobile number<input autoComplete="tel-national" inputMode="tel" type="tel" value={phone} onChange={event => setPhone(event.target.value)} required placeholder="98765 43210" aria-describedby="phone-otp-help"/></label>
      <small id="phone-otp-help" className="phone-otp-help">Enter a 10-digit Indian mobile number; +91 is optional.</small>
      <label>Quick security check: {challenge?.question ?? 'Loading…'}<input inputMode="numeric" pattern="[0-9]*" autoComplete="off" required value={answer} onChange={event => setAnswer(event.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Answer" disabled={!challenge}/></label>
      <button type="button" className="phone-captcha-refresh" onClick={() => void refreshChallenge()} disabled={!challenge || busy}>New question</button>
      <button type="submit" disabled={busy || !challenge || !normalized || answer.length === 0 || (mode === 'signup' && displayName.trim().length < 2)}>{busy ? 'Requesting…' : 'Send verification code'}</button>
    </form> : <form className="auth-form" onSubmit={verifyCode}>
      <p className="phone-otp-target">Code sent to {normalized}</p>
      <label>Six-digit verification code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="123456"/></label>
      <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
      <button type="button" className="phone-captcha-refresh" disabled={busy} onClick={() => { setStage('request'); setNotice(''); setError(''); void refreshChallenge(); }}>Use a different number or request another code</button>
    </form>}
  </section>;
}
