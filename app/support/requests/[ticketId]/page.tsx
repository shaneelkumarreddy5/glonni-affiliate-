import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Clock3, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import { replyToSupportTicket } from '../../actions';
import '../../support.css';
import '../tickets.css';

type Ticket={id:string;ticket_number:string;subject:string;category:string;status:string;created_at:string;updated_at:string};
type Message={id:string;author_type:string;body:string;created_at:string};
export default async function SupportConversation({params,searchParams}:{params:Promise<{ticketId:string}>;searchParams:Promise<{error?:string;success?:string}>}){
  const[{ticketId},query]=await Promise.all([params,searchParams]);const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();
  if(!user)redirect(`/login?next=${encodeURIComponent(`/support/requests/${ticketId}`)}`);
  const[{data:ticketData},{data:messageData}]=await Promise.all([supabase.from('support_tickets').select('id,ticket_number,subject,category,status,created_at,updated_at').eq('id',ticketId).eq('profile_id',user.id).maybeSingle(),supabase.from('support_messages').select('id,author_type,body,created_at').eq('ticket_id',ticketId).eq('visibility','customer').order('created_at')]);
  if(!ticketData)notFound();const ticket=ticketData as Ticket,messages=(messageData??[])as Message[],closed=['resolved','closed'].includes(ticket.status);
  return <><Header/><main className="support-layout"><BrowseNav items={[{label:'Help & Legal',href:'/account?section=help'},{label:'My support requests',href:'/support/requests'},{label:`Request #${ticket.ticket_number}`}]} fallback="/support/requests"/><div className="support-workspace" style={{display:'block'}}><section className="ticket-detail">
    <Link className="ticket-back" href="/support/requests"><ArrowLeft/>All support requests</Link>{query.error&&<p className="auth-notice error" role="alert">{query.error}</p>}{query.success&&<p className="auth-notice success" role="status">{query.success}</p>}
    <header className="ticket-detail-head"><div><p>REQUEST #{ticket.ticket_number}</p><h1>{ticket.subject}</h1><span>{ticket.category.replaceAll('_',' ')} · opened {new Date(ticket.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div><em className={ticket.status}>{ticket.status.replaceAll('_',' ')}</em></header>
    <section className="support-conversation">{messages.length?messages.map(message=><article className={message.author_type==='customer'?'customer':'agent'} key={message.id}><div><b>{message.author_type==='customer'?'You':'Glonni Support'}</b><time>{new Date(message.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</time></div><p>{message.body}</p></article>):<div className="support-empty"><MessageSquareText/><b>No visible messages</b><span>Add a reply below to continue this request.</span></div>}</section>
    {closed?<section className="ticket-closed"><ShieldCheck/><div><b>This request is {ticket.status}.</b><span>Open a new request if you need help with another issue.</span></div><Link href="/support/requests#new-request">Open new request</Link></section>:<form action={replyToSupportTicket} className="ticket-reply"><input type="hidden" name="ticketId" value={ticket.id}/><label>Reply to Glonni Support<textarea name="message" rows={5} minLength={2} maxLength={5000} required placeholder="Add information that helps our team. Never share passwords, OTPs, or complete bank details."/></label><div><small><Clock3/>Your reply is added to this request.</small><button type="submit">Send reply</button></div></form>}
  </section></div></main></>;
}
