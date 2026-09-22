import { Bot, CheckCircle2, CircleAlert, Headphones, ShieldCheck, TicketCheck } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminSupportQueue, type SupportQueueTicket } from '@/components/admin-support-queue';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RawTicket = {
  id: string; ticket_number: string | number; subject: string; category: string; status: string; priority: string;
  source_channel: 'chatbot' | 'email' | 'voice'; support_state: string; updated_at: string; ai_confidence: number | null;
  profile_id: string; assigned_to: string | null; merchant_id: string | null;
  profiles: { display_name: string | null } | null; merchants: { name: string | null } | null;
};

export default async function SupportPage() {
  const supabase = await createClient();
  const [{ data: ticketRows }, { data: faqs }] = await Promise.all([
    supabase.from('support_tickets').select('id,ticket_number,subject,category,status,priority,source_channel,support_state,updated_at,ai_confidence,profile_id,assigned_to,merchant_id,profiles:profile_id(display_name),merchants:merchant_id(name)').order('updated_at', { ascending: false }).limit(200),
    supabase.from('support_faqs').select('id,scope').eq('is_active', true),
  ]);
  const rawTickets = (ticketRows ?? []) as unknown as RawTicket[];
  const assigneeIds = [...new Set(rawTickets.map((ticket) => ticket.assigned_to).filter((id): id is string => Boolean(id)))];
  const { data: assignees } = assigneeIds.length ? await supabase.from('profiles').select('id,display_name').in('id', assigneeIds) : { data: [] as Array<{ id: string; display_name: string | null }> };
  const names = new Map((assignees ?? []).map((profile) => [profile.id, profile.display_name]));
  const tickets: SupportQueueTicket[] = rawTickets.map((ticket) => ({
    id: ticket.id, ticketNumber: String(ticket.ticket_number), subject: ticket.subject, category: ticket.category,
    status: ticket.status, priority: ticket.priority, sourceChannel: ticket.source_channel, supportState: ticket.support_state,
    updatedAt: ticket.updated_at, profileName: ticket.profiles?.display_name ?? null, merchantName: ticket.merchants?.name ?? null,
    assignedName: ticket.assigned_to ? names.get(ticket.assigned_to) ?? null : null, aiConfidence: ticket.ai_confidence,
  }));
  const open = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;
  const aiHandling = tickets.filter((ticket) => ticket.supportState === 'ai_handling').length;
  const needsHuman = tickets.filter((ticket) => ticket.supportState === 'needs_human_review').length;
  const highPriority = tickets.filter((ticket) => ['high', 'urgent'].includes(ticket.priority) && !['resolved', 'closed'].includes(ticket.status)).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const resolvedToday = tickets.filter((ticket) => ticket.supportState === 'resolved' && new Date(ticket.updatedAt) >= today).length;
  const faqScopes = new Set((faqs ?? []).map((faq) => faq.scope));

  return <main className="admin-v2 support-admin-page"><AdminSidebar /><section className="admin-main"><main className="admin-content support-admin-content">
    <header className="support-admin-hero"><div><p>SUPPORT &amp; TRUST</p><h1>Support Centre</h1><span>One verified queue for chatbot, email and voice conversations. AI may explain approved knowledge; people control financial, security and account decisions.</span></div><a href="/admin/support" className="support-new-ticket"><TicketCheck />Live support queue</a></header>
    <section className="support-overview-cards" aria-label="Support summary">
      <article><span className="support-card-icon blue"><Headphones /></span><div><small>Open conversations</small><b>{open}</b><em>Needs an answer or next step</em></div></article>
      <article><span className="support-card-icon violet"><Bot /></span><div><small>AI handling</small><b>{aiHandling}</b><em>Using approved answers only</em></div></article>
      <article><span className="support-card-icon amber"><ShieldCheck /></span><div><small>Needs human review</small><b>{needsHuman}</b><em>Money, security or uncertainty</em></div></article>
      <article><span className="support-card-icon red"><CircleAlert /></span><div><small>High priority</small><b>{highPriority}</b><em>Open high or urgent tickets</em></div></article>
      <article><span className="support-card-icon green"><CheckCircle2 /></span><div><small>Resolved today</small><b>{resolvedToday}</b><em>Customer outcomes completed</em></div></article>
    </section>
    <p className="support-admin-safety"><ShieldCheck />Do not request or store passwords, OTPs, PINs, full bank details or full card details in support messages.</p>
    <AdminSupportQueue tickets={tickets} knowledgeCount={(faqs ?? []).length} />
    <section className="support-source-grid" aria-label="Support data connections">
      <article><div><Bot /><span><b>Knowledge base connected</b><small>{(faqs ?? []).length} active approved answer{(faqs ?? []).length === 1 ? '' : 's'} are available to AI support.</small></span></div><p>Sources: general guidance, cashback, wallet, account, merchant and exact-offer rules.</p><em>{faqScopes.size} source areas active</em></article>
      <article><div><ShieldCheck /><span><b>Human safeguards active</b><small>Cashback adjustments, wallet movement and security actions cannot be decided by the chatbot.</small></span></div><p>Every human action, assignment, resolution and override is written to the support audit history.</p><em>Admin review required</em></article>
    </section>
  </main></section></main>;
}
