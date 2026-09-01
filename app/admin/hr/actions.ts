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
  const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: { mode: 'update_employee', employeeId, status } });
  if (error || data?.error) redirect(`/admin/team?error=${enc(data?.error ?? error?.message ?? 'Status update failed.')}`);
  revalidatePath('/admin/team'); redirect('/admin/team?success=Employee+status+updated.');
}

export async function updateEmployee(formData: FormData) {
  const { supabase } = await requireAal2();
  const employeeId = String(formData.get('employeeId') ?? '');
  const payload = {
    mode: 'update_employee', employeeId,
    displayName: String(formData.get('displayName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    jobTitle: String(formData.get('jobTitle') ?? ''),
    departmentId: String(formData.get('departmentId') ?? '') || null,
    managerId: String(formData.get('managerId') ?? '') || null,
    employmentType: String(formData.get('employmentType') ?? 'full_time'),
    joiningDate: String(formData.get('joiningDate') ?? '') || null,
    role: String(formData.get('role') ?? 'editor'),
    status: String(formData.get('status') ?? 'active'),
    approvalLimit: Number(formData.get('approvalLimit') ?? 0),
  };
  const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: payload });
  if (error || data?.error) redirect(`/admin/team/${employeeId}?error=${enc(data?.error ?? error?.message ?? 'Employee update failed.')}`);
  revalidatePath('/admin/team'); revalidatePath(`/admin/team/${employeeId}`);
  redirect(`/admin/team/${employeeId}?success=${enc('Employee profile, role and access controls updated.')}`);
}

export async function revokeEmployeeSessions(formData: FormData) {
  const { supabase } = await requireAal2();
  const employeeId = String(formData.get('employeeId') ?? '');
  const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: { mode: 'revoke_sessions', employeeId } });
  if (error || data?.error) redirect(`/admin/team/${employeeId}?error=${enc(data?.error ?? error?.message ?? 'Session revocation failed.')}`);
  revalidatePath(`/admin/team/${employeeId}`);
  redirect(`/admin/team/${employeeId}?success=${enc('All employee sessions were revoked.')}`);
}

export async function resetEmployeeMfa(formData: FormData) {
  const { supabase } = await requireAal2();
  const employeeId = String(formData.get('employeeId') ?? '');
  const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: { mode: 'reset_mfa', employeeId } });
  if (error || data?.error) redirect(`/admin/team/${employeeId}?error=${enc(data?.error ?? error?.message ?? '2FA reset failed.')}`);
  revalidatePath(`/admin/team/${employeeId}`);
  redirect(`/admin/team/${employeeId}?success=${enc('2FA reset. The employee must enroll again at next login.')}`);
}

export async function revokeInvitation(formData: FormData) {
  const { supabase } = await requireAal2();
  const invitationId = String(formData.get('invitationId') ?? '');
  const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: { mode: 'revoke_invitation', invitationId } });
  if (error || data?.error) redirect(`/admin/invitations?error=${enc(data?.error ?? error?.message ?? 'Invitation revocation failed.')}`);
  revalidatePath('/admin/invitations');
  redirect('/admin/invitations?success=Invitation+revoked.');
}

export async function createAccessReview(formData: FormData) {
  const { supabase } = await requireAal2();
  const { error } = await supabase.from('access_reviews').insert({ employee_id: String(formData.get('employeeId')), reviewer_id: String(formData.get('reviewerId')), scheduled_for: String(formData.get('scheduledFor')), status: 'scheduled', notes: String(formData.get('notes') ?? '') });
  if (error) redirect(`/admin/access-reviews?error=${enc(error.message)}`);
  revalidatePath('/admin/access-reviews'); redirect('/admin/access-reviews?success=Access+review+scheduled.');
}

export async function completeAccessReview(formData: FormData) {
  const { supabase, user } = await requireAal2();
  const reviewId = String(formData.get('reviewId') ?? '');
  const status = String(formData.get('status') ?? 'completed');
  const decision = String(formData.get('decision') ?? '').trim();
  const { data: review, error } = await supabase.from('access_reviews').update({ status, decision, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', reviewId).select('employee_id').single();
  if (error) redirect(`/admin/access-reviews?error=${enc(error.message)}`);
  if (status === 'completed' && review) await supabase.from('employees').update({ last_access_review_at: new Date().toISOString() }).eq('profile_id', review.employee_id);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'employee_access_review_updated', entity_type: 'access_review', entity_id: reviewId, source: 'admin', metadata: { status, decision } });
  revalidatePath('/admin/access-reviews');
  redirect('/admin/access-reviews?success=Access+review+updated.');
}

export async function toggleDepartment(formData: FormData) {
  const { supabase } = await requireAal2();
  const departmentId = String(formData.get('departmentId') ?? '');
  const isActive = String(formData.get('isActive')) === 'true';
  const { error } = await supabase.from('departments').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', departmentId);
  if (error) redirect(`/admin/departments?error=${enc(error.message)}`);
  revalidatePath('/admin/departments'); redirect('/admin/departments?success=Department+status+updated.');
}
