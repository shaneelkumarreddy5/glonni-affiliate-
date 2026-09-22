'use client';

import Link from 'next/link';
import { Bot, ChevronRight, CircleAlert, Headphones, Mail, MessageSquareText, Search, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

export type SupportQueueTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  sourceChannel: 'chatbot' | 'email' | 'voice';
  supportState: string;
  updatedAt: string;
  profileName: string | null;
  merchantName: string | null;
  assignedName: string | null;
  aiConfidence: number | null;
};

type QueueFilter = 'all' | 'chatbot' | 'email' | 'voice' | 'needs_human_review' | 'mine' | 'resolved';

const channelIcon = (channel: SupportQueueTicket['sourceChannel']) => {
  if (channel === 'chatbot') return <MessageSquareText aria-hidden="true" />;
  if (channel === 'voice') return <Headphones aria-hidden="true" />;
  return <Mail aria-hidden="true" />;
};

const channelLabel = (channel: SupportQueueTicket['sourceChannel']) => channel === 'chatbot' ? 'Chatbot' : channel === 'voice' ? 'Voice' : 'Email';
const display = (value: string) => value.replaceAll('_', ' ');
const updatedLabel = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)} hr ago`;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
};

export function AdminSupportQueue({ tickets, knowledgeCount }: { tickets: SupportQueueTicket[]; knowledgeCount: number }) {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesFilter = filter === 'all'
        || (filter === 'resolved' && ticket.supportState === 'resolved')
        || (filter === 'needs_human_review' && ticket.supportState === 'needs_human_review')
        || (filter === 'mine' && ticket.supportState === 'human_assigned')
        || ticket.sourceChannel === filter;
      const searchable = [ticket.ticketNumber, ticket.subject, ticket.category, ticket.profileName, ticket.merchantName, ticket.assignedName].filter(Boolean).join(' ').toLowerCase();
      return matchesFilter && (!needle || searchable.includes(needle));
    });
  }, [filter, query, tickets]);

  const filters: Array<{ key: QueueFilter; label: string; icon?: React.ReactNode }> = [
    { key: 'all', label: 'All' },
    { key: 'chatbot', label: 'Chatbot', icon: <MessageSquareText /> },
    { key: 'email', label: 'Email', icon: <Mail /> },
    { key: 'voice', label: 'Voice', icon: <Headphones /> },
    { key: 'needs_human_review', label: 'Needs human review', icon: <ShieldCheck /> },
    { key: 'mine', label: 'Human assigned', icon: <UserRoundCheck /> },
    { key: 'resolved', label: 'Resolved' },
  ];

  return <section className="support-queue-card" aria-label="Support ticket queue">
    <div className="support-queue-topline">
      <div>
        <p>UNIFIED SUPPORT QUEUE</p>
        <h2>Every customer conversation in one place</h2>
      </div>
      <span className="support-kb-status"><Bot size={15} />{knowledgeCount} approved knowledge-base answers connected</span>
    </div>
    <nav className="support-queue-filters" aria-label="Filter support tickets">
      {filters.map((item) => <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.icon}{item.label}</button>)}
    </nav>
    <label className="support-queue-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets, customers, stores or order IDs" aria-label="Search support tickets" /></label>
    <div className="support-queue-table-wrap">
      <table className="support-queue-table">
        <thead><tr><th>Ticket</th><th>Customer</th><th>Channel</th><th>Issue</th><th>AI status</th><th>Priority</th><th>Assigned to</th><th>Updated</th><th>Action</th></tr></thead>
        <tbody>{filtered.length ? filtered.map((ticket) => <tr key={ticket.id}>
          <td><Link href={`/admin/support/${ticket.id}`} className="support-ticket-number">SUP-{ticket.ticketNumber}</Link><small>{ticket.subject}</small></td>
          <td><b>{ticket.profileName || 'Customer'}</b>{ticket.merchantName && <small>{ticket.merchantName}</small>}</td>
          <td><span className={`support-channel channel-${ticket.sourceChannel}`}>{channelIcon(ticket.sourceChannel)}{channelLabel(ticket.sourceChannel)}</span></td>
          <td><span className="support-category">{display(ticket.category)}</span></td>
          <td><span className={`support-state state-${ticket.supportState}`}>{ticket.supportState === 'ai_handling' ? <Bot /> : ticket.supportState === 'needs_human_review' ? <ShieldCheck /> : ticket.supportState === 'resolved' ? <UserRoundCheck /> : <CircleAlert />}{display(ticket.supportState)}{ticket.aiConfidence !== null && <small>{ticket.aiConfidence}%</small>}</span></td>
          <td><span className={`support-priority priority-${ticket.priority}`}>{ticket.priority}</span></td>
          <td>{ticket.assignedName || <span className="support-unassigned">Unassigned</span>}</td>
          <td>{updatedLabel(ticket.updatedAt)}</td>
          <td><Link href={`/admin/support/${ticket.id}`} className="support-open-link">Open details <ChevronRight /></Link></td>
        </tr>) : <tr><td colSpan={9}><div className="support-queue-empty"><MessageSquareText /><b>No tickets match this view</b><span>Change the filter or search for another customer, store, or ticket.</span></div></td></tr>}</tbody>
      </table>
    </div>
  </section>;
}
