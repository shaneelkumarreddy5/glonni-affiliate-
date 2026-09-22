import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock3, MessageSquareText, Plus, TicketCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import { createSupportTicket } from '../actions';
import { SupportChannelNav } from '@/components/support-channel-nav';
import '../support.css';
import './tickets.css';

type Ticket={id:string;ticket_number:string;subject:string;category:string;status:string;support_state:string;source_channel:string;updated_at:string};
export default async function SupportRequestsPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}){
  const params=await searchParams,supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login?next=/support/requests');
  const{data}=await supabase.from('support_tickets').select('id,ticket_number,subject,category,status,support_state,source_channel,updated_at').eq('profile_id',user.id).order('updated_at',{ascending:false}).limit(50);const tickets=(data??[])as Ticket[];
  return <><Header/><main className="support-layout"><BrowseNav items={[{label:'Profile',href:'/account?section=help'},{label:'Help & Legal',href:'/account?section=help'},{label:'My support requests'}]} fallback="/account?section=help"/><SupportChannelNav active="requests"/><div className="support-workspace" style={{display:'block'}}><section className="requests-page">
    {params.error&&<p className="auth-notice error" role="alert">{params.error}</p>}{params.success&&<p className="auth-notice success" role="status">{params.success}</p>}
    <header className="support-page-head"><div><p>HUMAN SUPPORT</p><h1>My support requests</h1><span>Open a request to read the conversation, check its status, and reply to the support team.</span></div><Link href="#new-request"><Plus size={16}/>Create support request</Link></header>
    <div className="ticket-board">{tickets.length?tickets.map(ticket=><Link href={`/support/requests/${ticket.id}`} className="ticket-row" key={ticket.id}><TicketCheck/><div><b>#{ticket.ticket_number} · {ticket.subject}</b><small>{ticket.source_channel} · {ticket.category.replaceAll('_',' ')} · updated {new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(ticket.updated_at))}</small></div><em className={ticket.support_state}>{ticket.support_state.replaceAll('_',' ')}</em></Link>):<div className="support-empty"><MessageSquareText size={27}/><b>No support requests yet</b><span>Ask Glonni first, or create a request when a person needs to review your issue.</span><Link href="/support">Ask Glonni</Link></div>}</div>
    <section id="new-request" className="new-ticket"><div><p>ESCALATE TO HUMAN SUPPORT</p><h2>Open a support request</h2><span>Never include your password, OTP, card number, or full bank details.</span></div><form action={createSupportTicket}><input type="hidden" name="sourceChannel" value="email"/><label>Category<select name="category" defaultValue="cashback"><option value="cashback">Cashback or eligibility</option><option value="withdrawal">Withdrawal or wallet</option><option value="order">Order or missing tracking</option><option value="deal">Deal, price or coupon</option><option value="account">Account help</option><option value="security">Security concern</option><option value="other">Something else</option></select></label><label>Subject<input name="subject" required minLength={4} maxLength={180} placeholder="Example: Cashback is still pending"/></label><label className="wide">Tell us what happened<textarea name="message" required minLength={10} maxLength={5000} rows={5} placeholder="Include the store, order ID if available, and the date. Do not include passwords, OTPs, or full bank details."/></label><button className="primary" type="submit">Open support request</button><small><Clock3 size={14}/>We usually reply within 24 hours.</small></form></section>
  </section></div></main></>;
}
