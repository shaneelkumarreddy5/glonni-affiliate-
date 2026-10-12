import Link from 'next/link';
import { Header } from '@/components/header';
import { requestPasswordReset } from '@/app/auth/actions';
import { SimpleCaptcha } from '@/components/simple-captcha';
import { safeCustomerReturnPath } from '@/lib/navigation';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; next?: string }> }) {
  const { error, success, next: requestedNext } = await searchParams;
  const next = safeCustomerReturnPath(requestedNext);
  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1><p className="auth-intro">Enter your customer email. We’ll send a secure five-minute recovery link if the account exists.</p>{error && <p className="auth-notice error" role="alert">{error}</p>}{success && <p className="auth-notice success" role="status">{success}</p>}<form action={requestPasswordReset} className="auth-form"><input type="hidden" name="next" value={next}/><label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com"/></label><SimpleCaptcha/><button type="submit">Send recovery link</button></form><Link className="auth-back" href={`/login?next=${encodeURIComponent(next)}`}>← Back to sign in</Link></section></main></>;
}
