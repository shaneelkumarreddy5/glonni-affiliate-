import { UserPlus } from 'lucide-react';
import { HrPageShell } from '@/components/hr-page-shell';
import { EmployeeInviteForm } from '@/components/employee-invite-form';
import { createClient } from '@/lib/supabase/server';

export default async function NewEmployeePage() {
  const supabase = await createClient();
  const [{ data: departments }, { data: employees }, { data: profiles }] = await Promise.all([
    supabase.from('departments').select('id,name').eq('is_active', true).order('name'),
    supabase.from('employees').select('profile_id,work_email,status').eq('status', 'active'),
    supabase.from('profiles').select('id,display_name'),
  ]);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const managers = (employees ?? []).map((employee) => ({ id: employee.profile_id, name: names.get(employee.profile_id) ?? employee.work_email }));
  return <HrPageShell title="Invite Employee" subtitle="Create the HR record, protected admin identity and scanner-safe private onboarding link.">
    <section className="employee-form-page"><div className="hr-form-title"><UserPlus/><div><p className="eyebrow">NEW EMPLOYEE</p><h2>Employment and access details</h2></div></div><EmployeeInviteForm departments={departments ?? []} managers={managers}/></section>
  </HrPageShell>;
}
