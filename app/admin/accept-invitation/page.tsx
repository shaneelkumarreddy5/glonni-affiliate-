import { EmployeeSetupForm } from '@/components/employee-setup-form';

export default function AcceptInvitationPage() {
  return <main className="admin-auth-page"><section className="admin-auth-card"><a className="logo" href="/">Glonn<i>i</i></a><p className="eyebrow">SECURE EMPLOYEE ONBOARDING</p><h1>Create your admin password</h1><p>This private link is scanner-safe and is consumed only when you save your password. Next, sign in and enroll Google Authenticator.</p><EmployeeSetupForm/><small>Your password is sent directly to Supabase and is never visible to the Glonni Owner or stored by Glonni.</small></section></main>;
}
