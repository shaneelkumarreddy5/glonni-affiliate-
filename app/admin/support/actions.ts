'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type SupportState = 'ai_handling' | 'needs_human_review' | 'human_assigned' | 'waiting_on_provider' | 'on_hold' | 'resolved';
const ticketUrl = (ticketId: string, message: string, kind: 'success' | 'error' = 'success') => `/admin/support/${ticketId}?${kind}=${encodeURIComponent(message)}`;

function refreshSupport(ticketId?: string) {
  revalidatePath('/admin/support'); revalidatePath('/support'); revalidatePath('/support/requests');
  if (ticketId) { revalidatePath(`/admin/support/${ticketId}`); revalidatePath(`/support/requests/${ticketId}`); }
}

async function requireSupportStaff(roles: Array<'owner' | 'admin' | 'editor'> = ['owner', 'admin', 'editor']) {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect('/admin/login?next=/admin/support');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !roles.includes(profile.role as 'owner' | 'admin' | 'editor') || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') throw new Error('An active administrator with verified 2FA is required.');
  return { supabase, user, role: profile.role as 'owner' | 'admin' | 'editor' };
}

async function supportEvent(supabase: Awaited<ReturnType<typeof createClient>>, ticketId: string, actorId: string, eventType: string, detail: Record<string, unknown> = {}, visibility: 'customer' | 'internal' = 'internal') {
  const [{ error: eventError }, { error: auditError }] = await Promise.all([
    supabase.from('support_ticket_events').insert({ ticket_id: ticketId, actor_id: actorId, event_type: eventType, detail, visibility }),
    supabase.from('audit_events').insert({ actor_id: actorId, event_type: eventType, entity_type: 'support_ticket', entity_id: ticketId, source: 'admin_support', metadata: detail }),
  ]);
  if (eventError) throw new Error(eventError.message);
  if (auditError) throw new Error(auditError.message);
}

async function readTicketForAction(supabase: Awaited<ReturnType<typeof createClient>>, ticketId: string) {
  if (!ticketId) throw new Error('Support ticket not found.');
  const { data, error } = await supabase.from('support_tickets').select('id,assigned_to,status,support_state').eq('id', ticketId).single();
  if (error || !data) throw new Error('Support ticket not found.');
  return data as { id: string; assigned_to: string | null; status: string; support_state: SupportState };
}

export async function replyToSupportTicket(formData: FormData) {
  const { supabase, user } = await requireSupportStaff();
  const ticketId = String(formData.get('ticketId') ?? ''), body = String(formData.get('body') ?? '').trim(), visibility = String(formData.get('visibility') ?? 'customer'), status = String(formData.get('status') ?? 'waiting_on_customer');
  if (!ticketId || body.length < 2 || body.length > 5000 || !['customer', 'internal'].includes(visibility) || !['in_review', 'waiting_on_customer'].includes(status)) redirect(ticketUrl(ticketId, 'Add a valid message and ticket status.', 'error'));
  const ticket = await readTicketForAction(supabase, ticketId), now = new Date().toISOString();
  const { error: messageError } = await supabase.from('support_messages').insert({ ticket_id: ticketId, author_id: user.id, author_type: 'agent', body, visibility });
  if (messageError) throw new Error(messageError.message);
  const ticketPatch = {
    status, support_state: 'human_assigned', assigned_to: ticket.assigned_to ?? user.id,
    ...(ticket.assigned_to ? {} : { assigned_at: now }), updated_at: now, resolved_at: null,
    resolved_by: null, resolution_type: null,
  };
  const { error: ticketError } = await supabase.from('support_tickets').update(ticketPatch).eq('id', ticketId);
  if (ticketError) throw new Error(ticketError.message);
  await supportEvent(supabase, ticketId, user.id, visibility === 'internal' ? 'support_internal_note_added' : 'support_reply_sent', { status, visibility }, visibility as 'customer' | 'internal');
  refreshSupport(ticketId); redirect(ticketUrl(ticketId, visibility === 'internal' ? 'Internal note saved.' : 'Customer reply sent.'));
}

export async function assignSupportTicketToMe(formData: FormData) {
  const { supabase, user } = await requireSupportStaff(); const ticketId = String(formData.get('ticketId') ?? ''); const ticket = await readTicketForAction(supabase, ticketId);
  if (ticket.assigned_to && ticket.assigned_to !== user.id) redirect(ticketUrl(ticketId, 'This case is already assigned to another team member.', 'error'));
  const now = new Date().toISOString();
  const { error } = await supabase.from('support_tickets').update({ assigned_to: user.id, ...(ticket.assigned_to ? {} : { assigned_at: now }), support_state: 'human_assigned', status: 'in_review', updated_at: now }).eq('id', ticketId);
  if (error) throw new Error(error.message);
  await supportEvent(supabase, ticketId, user.id, 'support_ticket_assigned', { assignee_id: user.id }); refreshSupport(ticketId); redirect(ticketUrl(ticketId, 'Case assigned to you.'));
}

export async function sendSupportTicketToHumanReview(formData: FormData) {
  const { supabase, user } = await requireSupportStaff(); const ticketId = String(formData.get('ticketId') ?? ''), reason = String(formData.get('reason') ?? 'Administrator requested human review.').trim().slice(0, 500);
  await readTicketForAction(supabase, ticketId); const now = new Date().toISOString();
  const { error } = await supabase.from('support_tickets').update({ support_state: 'needs_human_review', status: 'open', escalation_reason: reason || 'Administrator requested human review.', escalated_at: now, updated_at: now }).eq('id', ticketId);
  if (error) throw new Error(error.message);
  await supportEvent(supabase, ticketId, user.id, 'support_ticket_human_review_requested', { reason: reason || null }); refreshSupport(ticketId); redirect(ticketUrl(ticketId, 'Case moved to the human review queue.'));
}

export async function setSupportTicketWaiting(formData: FormData) {
  const { supabase, user } = await requireSupportStaff(); const ticketId = String(formData.get('ticketId') ?? ''), waitingFor = String(formData.get('waitingFor') ?? 'customer');
  if (!['customer', 'provider'].includes(waitingFor)) redirect(ticketUrl(ticketId, 'Choose who the case is waiting for.', 'error'));
  const now = new Date().toISOString();
  const patch = waitingFor === 'customer' ? { status: 'waiting_on_customer', support_state: 'human_assigned' as SupportState } : { status: 'in_review', support_state: 'waiting_on_provider' as SupportState };
  const { error } = await supabase.from('support_tickets').update({ ...patch, assigned_to: user.id, assigned_at: now, updated_at: now }).eq('id', ticketId);
  if (error) throw new Error(error.message);
  await supportEvent(supabase, ticketId, user.id, `support_ticket_waiting_on_${waitingFor}`, { waiting_for: waitingFor }); refreshSupport(ticketId); redirect(ticketUrl(ticketId, waitingFor === 'customer' ? 'Case marked as waiting for the customer.' : 'Case marked as waiting for the provider.'));
}

export async function resolveSupportTicket(formData: FormData) {
  const { supabase, user } = await requireSupportStaff(); const ticketId = String(formData.get('ticketId') ?? ''), resolutionType = String(formData.get('resolutionType') ?? 'answered'), resolutionNote = String(formData.get('resolutionNote') ?? '').trim();
  if (!ticketId || !['answered', 'provider_confirmed', 'not_eligible', 'security_guidance', 'other'].includes(resolutionType) || resolutionNote.length < 5 || resolutionNote.length > 1000) redirect(ticketUrl(ticketId, 'Add a clear resolution note before resolving this case.', 'error'));
  const now = new Date().toISOString();
  const { error } = await supabase.from('support_tickets').update({ status: 'resolved', support_state: 'resolved', assigned_to: user.id, assigned_at: now, resolved_by: user.id, resolved_at: now, resolution_type: resolutionType, resolution_note: resolutionNote, updated_at: now }).eq('id', ticketId);
  if (error) throw new Error(error.message);
  await supportEvent(supabase, ticketId, user.id, 'support_ticket_resolved', { resolution_type: resolutionType, resolution_note: resolutionNote }, 'customer'); refreshSupport(ticketId); redirect(ticketUrl(ticketId, 'Case resolved.'));
}

export async function submitSupportOverride(formData: FormData) {
  const { supabase, user } = await requireSupportStaff(['owner', 'admin']);
  const ticketId = String(formData.get('ticketId') ?? ''), overrideType = String(formData.get('overrideType') ?? 'other'), decision = String(formData.get('decision') ?? '').trim(), reason = String(formData.get('reason') ?? '').trim(), evidenceReference = String(formData.get('evidenceReference') ?? '').trim(), customerMessage = String(formData.get('customerMessage') ?? '').trim(), rawAmount = String(formData.get('adjustmentAmount') ?? '').trim();
  const adjustmentAmount = rawAmount ? Number(rawAmount) : null;
  if (!ticketId || !['cashback_adjustment', 'case_resolution', 'account_recovery', 'other'].includes(overrideType) || decision.length < 3 || reason.length < 10 || customerMessage.length < 10 || (rawAmount && (!Number.isFinite(adjustmentAmount) || adjustmentAmount! < 0))) redirect(ticketUrl(ticketId, 'Complete every required override field.', 'error'));
  const { data: override, error } = await supabase.from('support_overrides').insert({ ticket_id: ticketId, submitted_by: user.id, override_type: overrideType, decision, reason, evidence_reference: evidenceReference || null, customer_message: customerMessage, adjustment_amount: adjustmentAmount, requires_owner_approval: true, approval_status: 'pending_approval' }).select('id').single();
  if (error || !override) throw new Error(error?.message ?? 'Could not save the override.');
  await supabase.from('support_tickets').update({ support_state: 'on_hold', updated_at: new Date().toISOString() }).eq('id', ticketId);
  await supportEvent(supabase, ticketId, user.id, 'support_override_submitted', { override_id: override.id, override_type: overrideType, decision, adjustment_amount: adjustmentAmount }); refreshSupport(ticketId); redirect(ticketUrl(ticketId, 'Manual override submitted for owner approval.'));
}

export async function decideSupportOverride(formData: FormData) {
  const { supabase, user, role } = await requireSupportStaff(['owner']); const ticketId = String(formData.get('ticketId') ?? ''), overrideId = String(formData.get('overrideId') ?? ''), decision = String(formData.get('decision') ?? '');
  if (!ticketId || !overrideId || !['approved', 'rejected'].includes(decision)) redirect(ticketUrl(ticketId, 'Choose approve or reject.', 'error'));
  const { error } = await supabase.from('support_overrides').update({ approval_status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', overrideId).eq('ticket_id', ticketId).eq('approval_status', 'pending_approval');
  if (error) throw new Error(error.message);
  await supportEvent(supabase, ticketId, user.id, `support_override_${decision}`, { override_id: overrideId, reviewer_role: role }); refreshSupport(ticketId); redirect(ticketUrl(ticketId, `Manual override ${decision}.`));
}
