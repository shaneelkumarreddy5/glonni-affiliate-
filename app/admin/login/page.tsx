import Link from 'next/link';
import { adminSignIn } from '@/app/admin/auth-actions';
import { SimpleCaptcha } from '@/components/simple-captcha';

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; next?: string }> }) {
  const params = await searchParams;
  return <main className="admin-auth-page"><section className="admin-auth-card"><a className="logo" href="/">Glonni</a><p className="eyebrow">SECURE ADMIN ACCESS</p><h1>Admin sign in</h1><p>Invitation-only access for the Glonni Owner and authorized employees.</p>{params.error && <div className="auth-notice error">{params.error}</div>}{params.success && <div className="auth-notice success">{params.success}</div>}<form action={adminSignIn} className="auth-form"><input type="hidden" name="next" value={params.next ?? '/admin/dashboard'}/><label>Work email<input type="email" name="email" autoComplete="username" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" minLength={12} required/></label><SimpleCaptcha/><button type="submit">Continue securely</button></form><div className="admin-auth-links"><Link href="/admin/forgot-password">Access help</Link><Link href="/">Return to Glonni</Link></div><small>Password plus Google Authenticator-compatible 2FA is mandatory.</small></section></main>;
}
