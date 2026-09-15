'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createSupportTicket(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support/requests');
  const category = String(formData.get('category') ?? 'other');
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  if (!['cashback','withdrawal','order','deal','account','security','other'].includes(category) || subject.length < 4 || subject.length > 180 || message.length < 10 || message.length > 5000) redirect('/support/requests?error=Please+add+a+clear+subject+and+message.#new-request');
  const { data: ticket, error } = await supabase.from('support_tickets').insert({ profile_id: user.id, category, subject, escalation_reason: 'customer_requested_human_support' }).select('id').single();
  if (error || !ticket) redirect('/support/requests?error=We+could+not+open+your+request.+Please+try+again.#new-request');
  const { error: messageError } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, author_id: user.id, author_type: 'customer', body: message });
  if (messageError) redirect(`/support/requests/${ticket.id}?error=Your+request+was+opened,+but+the+message+could+not+be+saved.+Please+add+it+again.`);
  await supabase.from('activity_events').insert({ actor_id: user.id, surface: 'customer', event_type: 'support_ticket_opened', endpoint: '/support', http_method: 'POST', request_status: 201, entity_type: 'support_ticket', entity_id: ticket.id });
  revalidatePath('/support/requests'); revalidatePath('/account'); revalidatePath('/admin/support');
  redirect(`/support/requests/${ticket.id}?success=Your+support+request+is+open.+Our+team+will+reply+here.`);
}

export async function replyToSupportTicket(formData: FormData) {
  const supabase=await createClient();
  const{data:{user}}=await supabase.auth.getUser();
  const ticketId=String(formData.get('ticketId')??'');
  if(!user)redirect(`/login?next=${encodeURIComponent(`/support/requests/${ticketId}`)}`);
  const body=String(formData.get('message')??'').trim();
  if(body.length<2||body.length>5000)redirect(`/support/requests/${ticketId}?error=Write+a+message+between+2+and+5,000+characters.`);
  const{data:ticket}=await supabase.from('support_tickets').select('id,status').eq('id',ticketId).eq('profile_id',user.id).maybeSingle();
  if(!ticket)redirect('/support/requests?error=That+support+request+could+not+be+found.');
  if(['resolved','closed'].includes(ticket.status))redirect(`/support/requests/${ticketId}?error=This+request+is+closed.+Open+a+new+request+if+you+still+need+help.`);
  const{error}=await supabase.from('support_messages').insert({ticket_id:ticketId,author_id:user.id,author_type:'customer',body});
  if(error)redirect(`/support/requests/${ticketId}?error=Your+reply+could+not+be+sent.+Please+try+again.`);
  revalidatePath(`/support/requests/${ticketId}`);revalidatePath('/admin/support');
  redirect(`/support/requests/${ticketId}?success=Your+reply+has+been+sent.`);
}
