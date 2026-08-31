import Link from 'next/link';
import { Header } from '@/components/header';
import { requestPasswordReset } from '@/app/auth/actions';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const { success } = await searchParams;
  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1><p className="auth-intro">Enter your customer email. We’ll send a secure reset link if the account exists.</p>{success && <p className="auth-notice success">{success}</p>}<form action={requestPasswordReset} className="auth-form"><label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com"/></label><button type="submit">Send reset link</button></form><Link className="auth-back" href="/login">← Back to sign in</Link></section></main></>;
}
