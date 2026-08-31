import { Header } from '@/components/header';
import { updatePassword } from '@/app/auth/actions';

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">SECURE ACCOUNT RECOVERY</p><h1>Choose a new password</h1><p className="auth-intro">After saving, sign in with your new password.</p>{error && <p className="auth-notice error">{error}</p>}<form action={updatePassword} className="auth-form"><label>New password<input type="password" name="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters"/></label><button type="submit">Save password</button></form></section></main></>;
}
