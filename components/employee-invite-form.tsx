'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Option = { id: string; name: string };

export function EmployeeInviteForm({ departments, managers }: { departments: Option[]; managers: Option[] }) {
  const [error, setError] = useState('');
  const [setupUrl, setSetupUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSetupUrl(''); setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      mode: 'employee', displayName: String(form.get('displayName') ?? ''), email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''), jobTitle: String(form.get('jobTitle') ?? ''),
      departmentId: String(form.get('departmentId') ?? '') || null, managerId: String(form.get('managerId') ?? '') || null,
      employmentType: String(form.get('employmentType') ?? 'full_time'), joiningDate: String(form.get('joiningDate') ?? '') || null,
      role: String(form.get('role') ?? 'editor'), approvalLimit: Number(form.get('approvalLimit') ?? 0),
    };
    const supabase = createClient();
    const { data, error: invokeError } = await supabase.functions.invoke('admin-invite-user', { body: payload });
    setLoading(false);
    if (invokeError || data?.error) return setError(data?.error ?? invokeError?.message ?? 'Invitation creation failed.');
    setSetupUrl(data.setupUrl);
    event.currentTarget.reset();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(setupUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  }

  return <>
    <form onSubmit={submit} className="employee-form">
      <fieldset><legend>Personal &amp; contact</legend><label>Full legal name *<input name="displayName" autoComplete="name" required/></label><label>Work email *<input name="email" type="email" autoComplete="email" required/></label><label>Mobile number<input name="phone" type="tel" autoComplete="tel" placeholder="+91"/></label></fieldset>
      <fieldset><legend>Employment</legend><label>Employee ID<span>Generated automatically</span><input value="GL-AUTO" disabled/></label><label>Job title *<input name="jobTitle" required/></label><label>Department<select name="departmentId"><option value="">Unassigned</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Reporting manager<select name="managerId"><option value="">No manager / Owner</option>{managers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Employment type<select name="employmentType"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contractor">Contractor</option><option value="intern">Intern</option></select></label><label>Joining date<input name="joiningDate" type="date"/></label></fieldset>
      <fieldset><legend>Admin security &amp; authority</legend><label>Role *<select name="role"><option value="editor">Team Member</option><option value="admin">Administrator</option><option value="owner">Owner</option></select></label><label>Financial approval limit (₹)<input name="approvalLimit" type="number" min="0" step="1" defaultValue="0"/></label><div className="security-checklist"><b>Automatically enforced</b><span>✓ Private scanner-safe setup link</span><span>✓ Password chosen only by the employee</span><span>✓ Mandatory Google Authenticator-compatible 2FA</span><span>✓ New-device password and 2FA challenge</span><span>✓ Complete invitation and onboarding audit trail</span></div></fieldset>
      {error && <p className="preview-note error-note">{error}</p>}
      <div className="form-actions"><a href="/admin/team">Cancel</a><button className="primary" disabled={loading}>{loading ? 'Creating securely…' : 'Create employee & private link'}</button></div>
    </form>
    {setupUrl && <section className="private-invite-result"><p className="eyebrow">PRIVATE INVITATION READY</p><h2>Send this link securely to the employee</h2><p>The link expires after 24 hours and is consumed only when the employee saves a password. Opening it does not invalidate it.</p><input readOnly value={setupUrl}/><button type="button" onClick={copyLink}>{copied ? 'Copied' : 'Copy private link'}</button><small>Do not post this link publicly or store it in notes. Create a new invitation if it expires.</small></section>}
  </>;
}
