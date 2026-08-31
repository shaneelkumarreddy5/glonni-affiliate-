import { redirect } from 'next/navigation';
import { completeAdminOnboarding } from '@/app/admin/auth-actions';
import { createClient } from '@/lib/supabase/server';

export default async function AdminOnboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login?error=Open+the+latest+invitation+link+first.');
  return <main className="admin-auth-page"><section className="admin-auth-card"><p className="eyebrow">EMPLOYEE ONBOARDING</p><h1>Secure your admin account</h1><p>Set your private password. Next, Glonni will require authenticator-app enrollment.</p>{error && <div className="auth-notice error">{error}</div>}<form action={completeAdminOnboarding} className="auth-form"><label>Work email<input value={user.email ?? ''} disabled/></label><label>Create password<input type="password" name="password" minLength={12} autoComplete="new-password" required placeholder="At least 12 characters"/></label><button type="submit">Save and set up 2FA</button></form></section></main>;
}
