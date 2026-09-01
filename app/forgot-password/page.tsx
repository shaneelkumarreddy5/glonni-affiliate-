import Link from 'next/link';
import { Header } from '@/components/header';
import { requestPasswordReset } from '@/app/auth/actions';
import { SimpleCaptcha } from '@/components/simple-captcha';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1><p className="auth-intro">Enter your customer email. We’ll send a secure five-minute recovery link if the account exists.</p>{error && <p className="auth-notice error">{error}</p>}{success && <p className="auth-notice success">{success}</p>}<form action={requestPasswordReset} className="auth-form"><label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com"/></label><SimpleCaptcha/><button type="submit">Send recovery link</button></form><Link className="auth-back" href="/login">← Back to sign in</Link></section></main></>;
}
