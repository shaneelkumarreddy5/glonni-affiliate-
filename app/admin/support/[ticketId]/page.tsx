import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, FileText, Headphones, Landmark, Mail, MessageSquareText, ShieldCheck, Store, TicketCheck, UserRound } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminSupportTicketActions, type PendingOverride } from '@/components/admin-support-ticket-actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ticket = {
  id: string; ticket_number: string | number; subject: string; category: string; status: string; priority: string;
  source_channel: 'chatbot' | 'email' | 'voice'; support_state: string; updated_at: string; created_at: string;
  assigned_to: string | null; merchant_id: string | null; offer_id: string | null; cashback_claim_id: string | null;
  ai_summary: string | null; ai_confidence: number | null; ai_recommendation: Record<string, unknown>; escalation_reason: string | null;
  resolution_type: string | null; resolution_note: string | null;
  profiles: { display_name: string | null; created_at: string } | null;
  merchants: { name: string; slug: string } | null;
  offers: { current_price: string | number | null; cashback_amount: string | number | null; status: string; products: { title: string | null } | null } | null;
  cashback_claims: { order_reference: string; purchase_amount: string | number | null; claimed_amount: string | number | null; status: string; created_at: string } | null;
};
type Message = { id: string; author_id: string | null; author_type: string; body: string; visibility: 'customer' | 'internal'; created_at: string };
type Event = { id: string; actor_id: string | null; event_type: string; detail: Record<string, unknown>; visibility: string; created_at: string };
type Faq = { id: string; scope: string; question: string; answer: string; keywords: string[] };
type OverrideRow = { id: string; override_type: string; decision: string; adjustment_amount: string | number | null; approval_status: string; created_at: string };

const display = (value: string | null | undefined) => (value ?? '').replaceAll('_', ' ');
const channelIcon = (channel: Ticket['source_channel']) => channel === 'chatbot' ? <MessageSquareText /> : channel === 'voice' ? <Headphones /> : <Mail />;
const channelName = (channel: Ticket['source_channel']) => channel === 'chatbot' ? 'Chatbot' : channel === 'voice' ? 'Voice' : 'Email';
const stamp = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export default async function SupportTicketPage({ params, searchParams }: { params: Promise<{ ticketId: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ ticketId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(`/admin/support/${ticketId}`)}`);
  const [{ data: ticketData }, { data: messagesData }, { data: eventData }, { data: overrideData }, { data: faqData }, { data: currentProfile }] = await Promise.all([
    supabase.from('support_tickets').select('id,ticket_number,subject,category,status,priority,source_channel,support_state,updated_at,created_at,assigned_to,merchant_id,offer_id,cashback_claim_id,ai_summary,ai_confidence,ai_recommendation,escalation_reason,resolution_type,resolution_note,profiles:profile_id(display_name,created_at),merchants:merchant_id(name,slug),offers:offer_id(current_price,cashback_amount,status,products(title)),cashback_claims:cashback_claim_id(order_reference,purchase_amount,claimed_amount,status,created_at)').eq('id', ticketId).maybeSingle(),
    supabase.from('support_messages').select('id,author_id,author_type,body,visibility,created_at').eq('ticket_id', ticketId).order('created_at'),
    supabase.from('support_ticket_events').select('id,actor_id,event_type,detail,visibility,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: false }).limit(20),
    supabase.from('support_overrides').select('id,override_type,decision,adjustment_amount,approval_status,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
    supabase.from('support_faqs').select('id,scope,question,answer,keywords').eq('is_active', true).order('display_order').limit(100),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ]);
  if (!ticketData) notFound();
  const ticket = ticketData as unknown as Ticket;
  const messages = (messagesData ?? []) as unknown as Message[];
  const events = (eventData ?? []) as unknown as Event[];
  const overrides = (overrideData ?? []) as unknown as OverrideRow[];
  const peopleIds = [...new Set([...messages.map((message) => message.author_id), ...events.map((event) => event.actor_id), ticket.assigned_to].filter((id): id is string => Boolean(id)))];
  const { data: people } = peopleIds.length ? await supabase.from('profiles').select('id,display_name').in('id', peopleIds) : { data: [] as Array<{ id: string; display_name: string | null }> };
  const peopleById = new Map((people ?? []).map((person) => [person.id, person.display_name || 'Team member']));
  const suggestedScopes = new Set(['general', ticket.category === 'withdrawal' ? 'wallet' : ticket.category === 'account' || ticket.category === 'security' ? 'account' : ticket.category === 'cashback' ? 'cashback' : 'deal']);
  const suggestedFaqs = ((faqData ?? []) as Faq[]).filter((faq) => suggestedScopes.has(faq.scope) || (ticket.merchant_id !== null && faq.scope === 'merchant') || (ticket.offer_id !== null && faq.scope === 'offer')).slice(0, 4);
  const pendingOverrides: PendingOverride[] = overrides.map((override) => ({ id: override.id, overrideType: override.override_type, decision: override.decision, amount: override.adjustment_amount === null ? null : String(override.adjustment_amount), status: override.approval_status, submittedAt: override.created_at }));
  const assigneeName = ticket.assigned_to ? peopleById.get(ticket.assigned_to) ?? 'Team member' : null;
  const canOverride = ['owner', 'admin'].includes(currentProfile?.role ?? '');
  const isOwner = currentProfile?.role === 'owner';

  return <main className="admin-v2 support-admin-page"><AdminSidebar /><section className="admin-main"><main className="admin-content support-ticket-content">
    <Link href="/admin/support" className="support-back"><ArrowLeft />All support conversations</Link>
    {query.success && <p className="support-notice success" role="status"><CheckCircle2 />{query.success}</p>}{query.error && <p className="support-notice error" role="alert"><CircleAlert />{query.error}</p>}
    <header className="support-ticket-head"><div><p>SUP-{ticket.ticket_number} · {display(ticket.category)}</p><h1>{ticket.subject}</h1><span className={`support-detail-state state-${ticket.support_state}`}>{channelIcon(ticket.source_channel)}{channelName(ticket.source_channel)}<i />{display(ticket.support_state)}</span><small><CircleAlert />Opening this page only views the case. It does not assign it to a human.</small></div><em className={`support-priority priority-${ticket.priority}`}>{ticket.priority} priority</em></header>
    <section className="support-ticket-layout">
      <div className="support-ticket-primary">
        <section className="support-conversation-card"><header><span><MessageSquareText />Conversation</span><small>{messages.length} message{messages.length === 1 ? '' : 's'}</small></header><div className="support-conversation-list">{messages.length ? messages.map((message) => <article key={message.id} className={`${message.author_type} ${message.visibility === 'internal' ? 'internal' : ''}`}><div className="support-message-avatar">{message.author_type === 'assistant' ? <Bot /> : message.author_type === 'agent' ? <UserRound /> : 'C'}</div><div><header><b>{message.author_type === 'customer' ? ticket.profiles?.display_name || 'Customer' : message.author_type === 'assistant' ? 'Ask Glonni' : peopleById.get(message.author_id ?? '') || 'Glonni Support'}{message.visibility === 'internal' && <em>Internal note</em>}</b><time>{stamp(message.created_at)}</time></header><p>{message.body}</p></div></article>) : <div className="support-ticket-empty"><MessageSquareText /><b>No messages yet</b><span>The case will show every customer reply, AI message and support reply here.</span></div>}</div></section>
        <AdminSupportTicketActions ticketId={ticket.id} supportState={ticket.support_state} assigneeName={assigneeName} canOverride={canOverride} isOwner={isOwner} pendingOverrides={pendingOverrides} />
      </div>
      <aside className="support-ticket-side">
        <section className="support-ai-summary"><header><Bot />AI summary{ticket.ai_confidence !== null && <em>{ticket.ai_confidence}% confidence</em>}</header><p>{ticket.ai_summary || 'No AI summary has been recorded for this case. A human should review the conversation and linked records.'}</p>{ticket.escalation_reason && <small><ShieldCheck />Escalated: {ticket.escalation_reason}</small>}</section>
        <section className="support-context-card"><header><UserRound />Customer</header><b>{ticket.profiles?.display_name || 'Customer'}</b><small>Member since {new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(ticket.profiles?.created_at ?? ticket.created_at))}</small><span><i className="status-dot" />Support case {display(ticket.status)}</span></section>
        <section className="support-context-card"><header><FileText />Related information</header>{ticket.merchants && <Link href={`/admin/stores/${ticket.merchants.slug}`}><Store />{ticket.merchants.name}</Link>}{ticket.offers && <div><b>{ticket.offers.products?.title || 'Linked offer'}</b><small>Offer status: {ticket.offers.status} · Cashback: {ticket.offers.cashback_amount === null ? 'Not set' : `₹${ticket.offers.cashback_amount}`}</small></div>}{ticket.cashback_claims && <div><b>Claim: {ticket.cashback_claims.order_reference}</b><small>{ticket.cashback_claims.status} · claimed ₹{ticket.cashback_claims.claimed_amount ?? '—'}</small></div>}{!ticket.merchants && !ticket.offers && !ticket.cashback_claims && <p>No store, offer, order or cashback claim is linked to this ticket.</p>}</section>
        <section className="support-knowledge-card"><header><Bot />Approved knowledge base <em>{suggestedFaqs.length}</em></header><p>These are the approved answers relevant to this case. AI support may use only active answers.</p>{suggestedFaqs.length ? <div>{suggestedFaqs.map((faq) => <details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div> : <span>No approved answers match this category yet.</span>}</section>
        <section className="support-activity-card"><header><TicketCheck />Activity</header>{events.length ? <ol>{events.map((event) => <li key={event.id}><i /><div><b>{display(event.event_type)}</b><small>{stamp(event.created_at)}{event.actor_id ? ` · ${peopleById.get(event.actor_id) || 'Team member'}` : ''}</small></div></li>)}</ol> : <p>No recorded support actions yet.</p>}</section>
      </aside>
    </section>
  </main></section></main>;
}
