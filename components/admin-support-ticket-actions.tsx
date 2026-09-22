'use client';

import { Check, ChevronDown, CircleAlert, Clock3, FileText, LockKeyhole, MoreHorizontal, Send, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import { useState } from 'react';
import {
  assignSupportTicketToMe,
  decideSupportOverride,
  replyToSupportTicket,
  resolveSupportTicket,
  sendSupportTicketToHumanReview,
  setSupportTicketWaiting,
  submitSupportOverride,
} from '@/app/admin/support/actions';

export type PendingOverride = { id: string; overrideType: string; decision: string; amount: string | null; status: string; submittedAt: string };

export function AdminSupportTicketActions({
  ticketId, supportState, assigneeName, canOverride, isOwner, pendingOverrides,
}: {
  ticketId: string; supportState: string; assigneeName: string | null; canOverride: boolean; isOwner: boolean; pendingOverrides: PendingOverride[];
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [messageMode, setMessageMode] = useState<'customer' | 'internal'>('customer');
  return <>
    <section className="support-detail-actions" aria-label="Case actions">
      <header><span><CircleAlert />Case actions</span><small>Opening this page does not assign the case.</small></header>
      {assigneeName ? <p className="support-assignee"><UserRoundCheck />Assigned to <b>{assigneeName}</b></p> : <form action={assignSupportTicketToMe}><input type="hidden" name="ticketId" value={ticketId} /><button className="support-action-primary" type="submit"><UserRoundCheck />Assign to me</button></form>}
      {supportState === 'ai_handling' && <form action={sendSupportTicketToHumanReview}><input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="reason" value="Administrator requested human review." /><button className="support-action-human" type="submit"><ShieldCheck />Send to human review</button></form>}
      <div className="support-wait-actions"><form action={setSupportTicketWaiting}><input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="waitingFor" value="customer" /><button type="submit"><Clock3 />Waiting for customer</button></form><form action={setSupportTicketWaiting}><input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="waitingFor" value="provider" /><button type="submit"><Clock3 />Waiting for provider</button></form></div>
      <button className="support-action-resolve" type="button" onClick={() => setShowResolve(true)}><Check />Resolve case</button>
      {canOverride && <button className="support-action-more" type="button" onClick={() => setShowOverride(true)}><MoreHorizontal />Manual override</button>}
    </section>

    <section className="support-reply-box" aria-label="Reply to support ticket">
      <div className="support-reply-tabs"><button type="button" className={messageMode === 'customer' ? 'active' : ''} onClick={() => setMessageMode('customer')}>Customer-visible reply</button><button type="button" className={messageMode === 'internal' ? 'active' : ''} onClick={() => setMessageMode('internal')}>Internal note</button></div>
      <form action={replyToSupportTicket}><input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="visibility" value={messageMode} /><textarea name="body" required minLength={2} maxLength={5000} rows={5} placeholder={messageMode === 'customer' ? 'Write a clear reply the customer can see…' : 'Write a private note for the support team…'} /><div><label>After sending<select name="status" defaultValue="waiting_on_customer"><option value="in_review">Keep in review</option><option value="waiting_on_customer">Waiting for customer</option></select></label><button type="submit"><Send />{messageMode === 'customer' ? 'Send reply' : 'Save note'}</button></div></form>
    </section>

    {pendingOverrides.length > 0 && <section className="support-pending-overrides"><header><span><LockKeyhole />Pending manual overrides</span><small>Original AI and provider decisions stay in the audit history.</small></header>{pendingOverrides.map((override) => <article key={override.id}><div><b>{override.decision}</b><small>{override.overrideType.replaceAll('_', ' ')}{override.amount ? ` · ₹${override.amount}` : ''}</small></div><em>{override.status.replaceAll('_', ' ')}</em>{isOwner && override.status === 'pending_approval' && <span><form action={decideSupportOverride}><input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="overrideId" value={override.id} /><input type="hidden" name="decision" value="approved" /><button type="submit">Approve</button></form><form action={decideSupportOverride}><input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="overrideId" value={override.id} /><input type="hidden" name="decision" value="rejected" /><button type="submit">Reject</button></form></span>}</article>)}</section>}

    {showResolve && <div className="support-modal-backdrop" role="presentation"><section className="support-mini-modal" role="dialog" aria-modal="true" aria-labelledby="resolve-title"><button className="support-modal-close" type="button" onClick={() => setShowResolve(false)} aria-label="Close resolution form"><X /></button><p>CASE RESOLUTION</p><h2 id="resolve-title">Resolve this case</h2><span>Add a short customer-safe record of the final outcome.</span><form action={resolveSupportTicket}><input type="hidden" name="ticketId" value={ticketId} /><label>Resolution type<select name="resolutionType" defaultValue="answered"><option value="answered">Answered and resolved</option><option value="provider_confirmed">Provider confirmed</option><option value="not_eligible">Not eligible</option><option value="security_guidance">Security guidance supplied</option><option value="other">Other</option></select></label><label>Resolution note<textarea name="resolutionNote" minLength={5} maxLength={1000} required rows={4} placeholder="What was resolved and what the customer needs to know" /></label><div className="support-modal-buttons"><button type="button" onClick={() => setShowResolve(false)}>Cancel</button><button className="primary" type="submit"><Check />Resolve case</button></div></form></section></div>}

    {showOverride && <div className="support-modal-backdrop" role="presentation"><section className="support-override-drawer" role="dialog" aria-modal="true" aria-labelledby="override-title"><button className="support-modal-close" type="button" onClick={() => setShowOverride(false)} aria-label="Close manual override"><X /></button><p>CONTROLLED EXCEPTION</p><h2 id="override-title">Manual override</h2><span>Use only where verified evidence justifies a different outcome. The original AI and provider recommendation remain in the audit history.</span><div className="support-override-current"><b>Current recommendation</b><p>Review the linked provider, order, cashback and conversation evidence before changing a customer outcome.</p></div><form action={submitSupportOverride}><input type="hidden" name="ticketId" value={ticketId} /><label>Override type<select name="overrideType" defaultValue="cashback_adjustment"><option value="cashback_adjustment">Cashback adjustment</option><option value="case_resolution">Case resolution</option><option value="account_recovery">Account recovery after verification</option><option value="other">Other controlled exception</option></select></label><label>Override decision <i>*</i><input name="decision" required minLength={3} maxLength={160} placeholder="Example: Approve provisional cashback adjustment" /></label><label>Adjustment amount <small>Optional</small><input name="adjustmentAmount" inputMode="decimal" placeholder="₹ 0.00" /></label><label>Reason for override <i>*</i><textarea name="reason" required minLength={10} maxLength={2000} rows={3} placeholder="Why is this different from the provider or AI recommendation?" /></label><label>Evidence reference <small>Optional</small><input name="evidenceReference" maxLength={500} placeholder="Order proof, internal reference or verified source" /></label><label>Customer-facing explanation <i>*</i><textarea name="customerMessage" required minLength={10} maxLength={3000} rows={3} placeholder="Explain the outcome without exposing internal information." /></label><p className="support-override-approval"><ShieldCheck />Requires owner approval before it changes a customer outcome.</p><div className="support-modal-buttons"><button type="button" onClick={() => setShowOverride(false)}>Cancel</button><button className="primary" type="submit"><FileText />Submit for approval</button></div></form></section></div>}
  </>;
}
