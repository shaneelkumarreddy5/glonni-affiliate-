import { BriefcaseBusiness, Building2, KeyRound, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { HrPageShell } from '@/components/hr-page-shell';
import { createClient } from '@/lib/supabase/server';
import { updateEmployeeStatus } from '@/app/admin/hr/actions';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const messages = await searchParams;
  const supabase = await createClient();
  const [{ data: employees }, { data: profiles }, { data: departments }] = await Promise.all([
    supabase.from('employees').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,display_name,role'),
    supabase.from('departments').select('id,name').eq('is_active', true).order('name'),
  ]);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const departmentMap = new Map((departments ?? []).map((department) => [department.id, department.name]));
  const active = (employees ?? []).filter((employee) => employee.status === 'active').length;
  return <HrPageShell title="Employees" subtitle="Invite, organize, review and safely offboard everyone who can access Glonni Admin.">
    {messages.error && <p className="preview-note error-note">{messages.error}</p>}
    {messages.success && <p className="preview-note success-note">{messages.success}</p>}
    <section className="admin-stats"><article><UsersRound/><div><small>Total employees</small><b>{employees?.length ?? 0}</b><em>Real HR records</em></div></article><article><ShieldCheck/><div><small>Active</small><b>{active}</b><em>Authorized accounts</em></div></article><article><KeyRound/><div><small>2FA required</small><b>100%</b><em>All admin roles</em></div></article><article><Building2/><div><small>Departments</small><b>{departments?.length ?? 0}</b><em>Operating teams</em></div></article><article><BriefcaseBusiness/><div><small>Pending onboarding</small><b>{(employees ?? []).filter((employee) => employee.status === 'invited').length}</b><em>Private link issued</em></div></article></section>
    <section className="hr-layout"><article className="store-table"><div className="table-head"><div><a className="current">Employee directory</a><a href="/admin/invitations">Invitations</a><a href="/admin/access-reviews">Access reviews</a></div></div><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>JOB TITLE</th><th>ROLE</th><th>2FA</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{(employees ?? []).map((employee) => { const profile = profileMap.get(employee.profile_id); return <tr key={employee.profile_id}><td><b className="store-initial">{profile?.display_name?.[0] ?? 'E'}</b><span><a href={`/admin/team/${employee.profile_id}`}><strong>{profile?.display_name ?? 'Employee'}</strong></a><small>{employee.work_email}<br/>{employee.employee_code}</small></span></td><td>{departmentMap.get(employee.department_id) ?? 'Unassigned'}</td><td>{employee.job_title}</td><td>{employee.assigned_role ?? profile?.role ?? 'editor'}</td><td><em className={employee.mfa_enrolled_at ? 'status-active' : 'status-paused'}>{employee.mfa_enrolled_at ? 'Verified' : 'Required'}</em></td><td><em className={employee.status === 'active' ? 'status-active' : 'status-paused'}>{employee.status}</em></td><td><a href={`/admin/team/${employee.profile_id}`}>View</a><form action={updateEmployeeStatus} className="inline-form"><input type="hidden" name="employeeId" value={employee.profile_id}/><select name="status" defaultValue={employee.status}><option value="invited">Invited</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="departed">Departed</option></select><button>Update</button></form></td></tr>; })}</tbody></table></div><footer>Suspension and offboarding remove effective permissions and revoke active sessions.</footer></article>
      <aside className="hr-form-card invite-cta"><div className="hr-form-title"><UserPlus/><div><p className="eyebrow">OWNER / HR ACTION</p><h2>Invite employee</h2></div></div><p>Create the complete HR record, assign the role and approval limit, then copy a scanner-safe private setup link.</p><ul><li>Password chosen privately by employee</li><li>Mandatory Google Authenticator 2FA</li><li>24-hour single-use setup token</li><li>Invitation and onboarding audit trail</li></ul><a className="primary invite-cta-button" href="/admin/team/new">Open employee invitation form</a></aside>
    </section>
  </HrPageShell>;
}
