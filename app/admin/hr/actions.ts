'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const enc = (value: string) => encodeURIComponent(value);
async function requireAal2() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!user || assurance?.currentLevel !== 'aal2') redirect('/admin/login');
  return { supabase, user };
}

export async function inviteEmployee(formData: FormData) {
  const { supabase } = await requireAal2();
  const payload = {
    mode: 'employee', email: String(formData.get('email') ?? ''), displayName: String(formData.get('displayName') ?? ''),
    role: String(formData.get('role') ?? 'editor'), departmentId: String(formData.get('departmentId') ?? '') || null,
    jobTitle: String(formData.get('jobTitle') ?? ''), employmentType: String(formData.get('employmentType') ?? 'full_time'),
    phone: String(formData.get('phone') ?? ''), managerId: String(formData.get('managerId') ?? '') || null,
    joiningDate: String(formData.get('joiningDate') ?? '') || null,
    approvalLimit: Number(formData.get('approvalLimit') ?? 0),
  };
  const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: payload });
  if (error || data?.error) redirect(`/admin/team?error=${enc(data?.error ?? error?.message ?? 'Invitation failed.')}`);
  revalidatePath('/admin/team'); revalidatePath('/admin/invitations');
  redirect(`/admin/team?success=${enc(`Invitation sent to ${payload.email}.`)}`);
}

export async function createDepartment(formData: FormData) {
  const { supabase } = await requireAal2();
  const { error } = await supabase.from('departments').insert({ name: String(formData.get('name') ?? '').trim(), code: String(formData.get('code') ?? '').trim().toUpperCase(), description: String(formData.get('description') ?? '').trim() });
  if (error) redirect(`/admin/departments?error=${enc(error.message)}`);
  revalidatePath('/admin/departments'); redirect('/admin/departments?success=Department+created.');
}

export async function updateEmployeeStatus(formData: FormData) {
  const { supabase, user } = await requireAal2();
  const employeeId = String(formData.get('employeeId') ?? ''); const status = String(formData.get('status') ?? 'active');
  if (employeeId === user.id && status !== 'active') redirect(`/admin/team?error=${enc('You cannot suspend your own active Owner session.')}`);
  const changes: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'departed') changes.termination_date = new Date().toISOString().slice(0,10);
  const { error } = await supabase.from('employees').update(changes).eq('profile_id', employeeId);
  if (error) redirect(`/admin/team?error=${enc(error.message)}`);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'employee_status_changed', entity_type: 'employee', entity_id: employeeId, source: 'admin', metadata: { status } });
  revalidatePath('/admin/team'); redirect('/admin/team?success=Employee+status+updated.');
}

export async function createAccessReview(formData: FormData) {
  const { supabase } = await requireAal2();
  const { error } = await supabase.from('access_reviews').insert({ employee_id: String(formData.get('employeeId')), reviewer_id: String(formData.get('reviewerId')), scheduled_for: String(formData.get('scheduledFor')), status: 'scheduled', notes: String(formData.get('notes') ?? '') });
  if (error) redirect(`/admin/access-reviews?error=${enc(error.message)}`);
  revalidatePath('/admin/access-reviews'); redirect('/admin/access-reviews?success=Access+review+scheduled.');
}
