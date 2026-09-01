import { ClipboardCheck } from 'lucide-react';
import { HrPageShell } from '@/components/hr-page-shell';
import { createClient } from '@/lib/supabase/server';
import { completeAccessReview, createAccessReview } from '@/app/admin/hr/actions';

export default async function AccessReviewsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const messages = await searchParams;
  const supabase = await createClient();
  const [{ data: reviews }, { data: employees }, { data: profiles }] = await Promise.all([
    supabase.from('access_reviews').select('*').order('scheduled_for'),
    supabase.from('employees').select('profile_id,work_email,status'),
    supabase.from('profiles').select('id,display_name'),
  ]);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  return <HrPageShell title="Access Reviews" subtitle="Regularly confirm that every employee still has the correct role, permissions and approval authority.">
    {messages.error && <p className="preview-note error-note">{messages.error}</p>}
    {messages.success && <p className="preview-note success-note">{messages.success}</p>}
    <section className="hr-layout"><article className="store-table"><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>REVIEWER</th><th>DATE</th><th>STATUS</th><th>DECISION / SCOPE</th><th>ACTION</th></tr></thead><tbody>{(reviews ?? []).map((review) => <tr key={review.id}><td><ClipboardCheck size={18}/><span><strong>{names.get(review.employee_id) ?? 'Employee'}</strong></span></td><td>{names.get(review.reviewer_id) ?? 'Reviewer'}</td><td>{review.scheduled_for}</td><td><em className={review.status === 'completed' ? 'status-active' : 'status-paused'}>{review.status}</em></td><td>{review.decision || review.notes || '—'}</td><td>{review.status !== 'completed' ? <form action={completeAccessReview} className="review-action"><input type="hidden" name="reviewId" value={review.id}/><input name="decision" required placeholder="Decision note"/><select name="status" defaultValue="completed"><option value="completed">Approve access</option><option value="changes_required">Changes required</option><option value="in_progress">In progress</option></select><button>Save</button></form> : 'Closed'}</td></tr>)}</tbody></table></div></article><aside className="hr-form-card"><p className="eyebrow">SECURITY GOVERNANCE</p><h2>Schedule review</h2><form action={createAccessReview} className="support-form"><label>Employee<select name="employeeId" required>{(employees ?? []).filter((employee) => employee.status !== 'departed').map((employee) => <option key={employee.profile_id} value={employee.profile_id}>{names.get(employee.profile_id)} · {employee.work_email}</option>)}</select></label><label>Reviewer<select name="reviewerId" required>{(employees ?? []).filter((employee) => employee.status === 'active').map((employee) => <option key={employee.profile_id} value={employee.profile_id}>{names.get(employee.profile_id)}</option>)}</select></label><label>Review date<input name="scheduledFor" type="date" required/></label><label>Review scope<textarea name="notes" rows={4} placeholder="Role, permissions, approval authority and current responsibilities"/></label><button className="primary">Schedule access review</button></form></aside></section>
  </HrPageShell>;
}
