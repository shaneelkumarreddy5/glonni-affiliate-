import { notFound } from 'next/navigation';
import { KeyRound, Laptop, ShieldCheck, UserRoundCog } from 'lucide-react';
import { HrPageShell } from '@/components/hr-page-shell';
import { createClient } from '@/lib/supabase/server';
import { resetEmployeeMfa, revokeEmployeeSessions, updateEmployee } from '@/app/admin/hr/actions';

export const dynamic = 'force-dynamic';

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';

export default async function EmployeeDetailPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ employeeId }, messages] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: employee }, { data: profile }, { data: departments }, { data: team }, { data: profiles }, { data: authorities }, { data: events }, securityResult] = await Promise.all([
    supabase.from('employees').select('*').eq('profile_id', employeeId).maybeSingle(),
    supabase.from('profiles').select('id,display_name,role').eq('id', employeeId).maybeSingle(),
    supabase.from('departments').select('id,name').eq('is_active', true).order('name'),
    supabase.from('employees').select('profile_id,work_email,status').neq('status', 'departed'),
    supabase.from('profiles').select('id,display_name'),
    supabase.from('approval_authorities').select('*').eq('employee_id', employeeId).order('area'),
    supabase.from('audit_events').select('id,event_type,metadata,created_at').eq('entity_type', 'employee').eq('entity_id', employeeId).order('created_at', { ascending: false }).limit(12),
    supabase.functions.invoke('admin-invite-user', { body: { mode: 'employee_security', employeeId } }),
  ]);
  if (!employee || !profile) notFound();
  const names = new Map((profiles ?? []).map((item) => [item.id, item.display_name]));
  const security = securityResult.data?.security as { emailConfirmed?: boolean; lastSignInAt?: string | null; mfaVerified?: boolean; mfaFactorCount?: number } | undefined;
  const assignedRole = employee.assigned_role ?? profile.role;

  return <HrPageShell title="Employee Profile" subtitle="Employment record, authority, authentication and security actions in one protected workspace.">
    {messages.error && <p className="preview-note error-note">{messages.error}</p>}
    {messages.success && <p className="preview-note success-note">{messages.success}</p>}
    <section className="employee-identity-card">
      <div className="employee-avatar">{(profile.display_name ?? 'E').split(' ').map((part: string) => part[0]).slice(0, 2).join('')}</div>
      <div><p className="eyebrow">{employee.employee_code}</p><h2>{profile.display_name}</h2><span>{employee.job_title} · {employee.work_email}</span></div>
      <em className={employee.status === 'active' ? 'status-active' : 'status-paused'}>{employee.status}</em>
      <a href="/admin/team">← Employee directory</a>
    </section>

    <section className="employee-detail-grid">
      <article className="hr-form-card employee-editor">
        <div className="hr-form-title"><UserRoundCog/><div><p className="eyebrow">HR RECORD & ACCESS</p><h2>Edit employee</h2></div></div>
        <form action={updateEmployee} className="employee-form compact-form">
          <input type="hidden" name="employeeId" value={employeeId}/>
          <fieldset><legend>Identity & employment</legend>
            <label>Full name *<input name="displayName" required defaultValue={profile.display_name ?? ''}/></label>
            <label>Work email<input disabled value={employee.work_email}/><span>Immutable identity field</span></label>
            <label>Phone<input name="phone" defaultValue={employee.phone ?? ''}/></label>
            <label>Job title *<input name="jobTitle" required defaultValue={employee.job_title}/></label>
            <label>Department<select name="departmentId" defaultValue={employee.department_id ?? ''}><option value="">Unassigned</option>{(departments ?? []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label>Reporting manager<select name="managerId" defaultValue={employee.manager_id ?? ''}><option value="">No manager / Owner</option>{(team ?? []).filter((item) => item.profile_id !== employeeId).map((item) => <option key={item.profile_id} value={item.profile_id}>{names.get(item.profile_id) ?? item.work_email}</option>)}</select></label>
            <label>Employment type<select name="employmentType" defaultValue={employee.employment_type}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contractor">Contractor</option><option value="intern">Intern</option></select></label>
            <label>Joining date<input name="joiningDate" type="date" defaultValue={employee.joining_date ?? ''}/></label>
          </fieldset>
          <fieldset><legend>Role & approval authority</legend>
            <label>Admin role<select name="role" defaultValue={assignedRole}><option value="editor">Team Member</option><option value="admin">Administrator</option><option value="owner">Owner</option></select></label>
            <label>Account status<select name="status" defaultValue={employee.status}><option value="invited">Invited</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="departed">Departed</option></select></label>
            <label>Financial approval limit (₹)<input name="approvalLimit" type="number" min="0" step="1" defaultValue={employee.approval_limit}/></label>
            <div className="security-checklist"><b>Access safeguards</b><span>Suspending or offboarding removes the live admin role.</span><span>Active sessions are revoked automatically.</span><span>Every change is written to the audit log.</span></div>
          </fieldset>
          <div className="form-actions"><a href="/admin/team">Cancel</a><button className="primary">Save employee & access</button></div>
        </form>
      </article>

      <aside className="employee-security-column">
        <article className="hr-form-card security-card"><div className="hr-form-title"><ShieldCheck/><div><p className="eyebrow">AUTHENTICATION</p><h2>Security status</h2></div></div>
          <dl className="security-facts"><div><dt>Email verified</dt><dd>{security?.emailConfirmed ? 'Yes' : 'No'}</dd></div><div><dt>Google Authenticator</dt><dd>{security?.mfaVerified ? `Verified (${security.mfaFactorCount})` : 'Not enrolled'}</dd></div><div><dt>Last sign-in</dt><dd>{dateTime(security?.lastSignInAt)}</dd></div><div><dt>Last access review</dt><dd>{dateTime(employee.last_access_review_at)}</dd></div></dl>
          <form action={revokeEmployeeSessions}><input type="hidden" name="employeeId" value={employeeId}/><button className="secondary danger-soft"><Laptop size={15}/> Revoke all sessions</button></form>
          <form action={resetEmployeeMfa}><input type="hidden" name="employeeId" value={employeeId}/><button className="secondary danger-soft"><KeyRound size={15}/> Reset employee 2FA</button></form>
          <small>Owner self-reset is blocked to prevent accidental lockout.</small>
        </article>

        <article className="hr-form-card"><p className="eyebrow">APPROVAL AREAS</p><h2>Assigned authority</h2>{authorities?.length ? <ul className="authority-list">{authorities.map((authority) => <li key={authority.id}><b>{authority.area}</b><span>{authority.can_approve ? `Approve up to ₹${Number(authority.amount_limit).toLocaleString('en-IN')}` : authority.can_review ? 'Review only' : 'No authority'}</span></li>)}</ul> : <p className="empty-state">No module-specific authority. The employee’s general approval limit is ₹{Number(employee.approval_limit).toLocaleString('en-IN')}.</p>}</article>
        <article className="hr-form-card"><p className="eyebrow">SECURITY AUDIT</p><h2>Recent access changes</h2><ul className="audit-list">{events?.length ? events.map((event) => <li key={event.id}><span>{event.event_type.replaceAll('_', ' ')}</span><small>{dateTime(event.created_at)}</small></li>) : <li><span>No employee-specific changes yet.</span></li>}</ul></article>
      </aside>
    </section>
  </HrPageShell>;
}
