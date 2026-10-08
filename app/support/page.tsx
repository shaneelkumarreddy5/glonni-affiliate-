import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { SupportAssistant } from '@/components/support-assistant';
import { SupportChannelNav } from '@/components/support-channel-nav';
import { ArrowRight, CheckCircle2, MessageSquareText, TicketCheck } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import './support.css';
import './support-home.css';
import './support-tabs.css';

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support');
  const [{ data: faqs }, { data: recentTickets }] = await Promise.all([
    supabase.from('support_faqs').select('id,question,answer,keywords,scope').eq('is_active', true).order('display_order'),
    supabase.from('support_tickets').select('id,ticket_number,subject,support_state,updated_at').eq('profile_id', user.id).order('updated_at', { ascending: false }).limit(3),
  ]);
  return <><Header/><main className="support-layout support-home-layout">
    <BrowseNav items={[{ label: 'Profile', href: '/account?section=help' }, { label: 'Help & Legal', href: '/account?section=help' }, { label: 'Support center' }]} fallback="/account?section=help"/>
    <header className="support-home-heading"><div><p>WE’RE HERE TO HELP</p><h1>Support center</h1><span>Get help with cashback, orders, or your account.</span></div><Link href="/support/requests"><TicketCheck size={18}/> View my requests</Link></header>
    <SupportChannelNav active="chat"/>
    <div className="support-home-grid">
      <div className="support-home-chat"><SupportAssistant faqs={(faqs ?? []) as never[]}/></div>
      <aside className="support-home-aside" aria-label="Recent support requests">
        <section className="support-side-card support-recent-card"><header><div><p>YOUR SUPPORT HISTORY</p><h2>Recent requests</h2></div><Link href="/support/requests">View all <ArrowRight size={14}/></Link></header>
          {recentTickets?.length ? <div className="support-recent-list">{recentTickets.map((ticket) => <Link href={`/support/requests/${ticket.id}`} key={ticket.id} className="support-recent-row"><span className="support-recent-icon"><MessageSquareText size={17}/></span><span className="support-recent-details"><b>{ticket.subject}</b><small>#{ticket.ticket_number} · updated {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(ticket.updated_at))}</small></span><span className={`support-recent-status ${ticket.support_state === 'resolved' ? 'resolved' : ''}`}>{ticket.support_state === 'resolved' ? <CheckCircle2 size={13}/> : null}{ticket.support_state.replaceAll('_', ' ')}</span></Link>)}</div> : <div className="support-recent-empty"><span className="support-option-icon"><TicketCheck size={19}/></span><b>No requests yet</b><small>Your support conversations and replies will appear here.</small><Link href="/support/requests">Open my requests <ArrowRight size={14}/></Link></div>}
        </section>
      </aside>
    </div>
  </main></>;
}
