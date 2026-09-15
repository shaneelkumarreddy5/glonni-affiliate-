import { Header } from '@/components/header';
import { updatePassword } from '@/app/auth/actions';
import { safeCustomerReturnPath } from '@/lib/navigation';

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: requestedNext } = await searchParams;
  const next = safeCustomerReturnPath(requestedNext);
  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">SECURE ACCOUNT RECOVERY</p><h1>Choose a new password</h1><p className="auth-intro">Use at least 8 characters. You’ll sign in again after saving.</p>{error && <p className="auth-notice error" role="alert">{error}</p>}<form action={updatePassword} className="auth-form"><input type="hidden" name="next" value={next}/><label>New password<input type="password" name="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters"/></label><label>Confirm new password<input type="password" name="passwordConfirmation" autoComplete="new-password" minLength={8} required placeholder="Enter it again"/></label><button type="submit">Save password</button></form></section></main></>;
}
