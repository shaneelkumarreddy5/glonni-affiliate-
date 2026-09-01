import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { signIn, signUp } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { SimpleCaptcha } from '@/components/simple-captcha';

type Props = { searchParams: Promise<{ mode?: string; next?: string; error?: string; success?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/account');
  const signup = params.mode === 'signup';
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/account';
  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">GLONNI ACCOUNT</p><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p className="auth-intro">{signup ? 'Save deals, manage alerts and access My Space securely.' : 'Sign in to continue to your personal Glonni space.'}</p><nav className="auth-tabs"><Link className={!signup ? 'active' : ''} href={`/login?mode=signin&next=${encodeURIComponent(next)}`}>Sign in</Link><Link className={signup ? 'active' : ''} href={`/login?mode=signup&next=${encodeURIComponent(next)}`}>Create account</Link></nav>{params.error && <p className="auth-notice error">{params.error}</p>}{params.success && <p className="auth-notice success">{params.success}</p>}<form action={signup ? signUp : signIn} className="auth-form"><input type="hidden" name="next" value={next}/>{signup && <label>Full name<input name="displayName" autoComplete="name" minLength={2} required placeholder="Your name"/></label>}<label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com"/></label><label>Password<input type="password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required placeholder="At least 8 characters"/></label>{!signup && <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>}<SimpleCaptcha/><button type="submit">{signup ? 'Create Glonni account' : 'Sign in securely'}</button></form><p className="auth-footnote">This is customer access only. Admin access will be connected separately.</p></section></main></>;
}
