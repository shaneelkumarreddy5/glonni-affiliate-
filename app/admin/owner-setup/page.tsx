import { OwnerSetupForm } from '@/components/owner-setup-form';

export default function OwnerSetupPage() {
  return <main className="admin-auth-page"><section className="admin-auth-card"><a className="logo" href="/">Glonni</a><p className="eyebrow">PRIVATE OWNER SETUP</p><h1>Create your Owner password</h1><p>This single-use setup is protected by a short-lived private token. Your password is sent directly to Supabase and is never stored by Glonni.</p><OwnerSetupForm/><small>After saving, sign in and enroll Google Authenticator before Admin access is activated.</small></section></main>;
}
