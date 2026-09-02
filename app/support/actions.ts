'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createSupportTicket(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support');
  const category = String(formData.get('category') ?? 'other');
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  if (!['cashback','withdrawal','order','deal','account','security','other'].includes(category) || subject.length < 4 || message.length < 10) redirect('/support?error=Please+add+a+clear+subject+and+message.');
  const { data: ticket, error } = await supabase.from('support_tickets').insert({ profile_id: user.id, category, subject, escalation_reason: 'customer_requested_human_support' }).select('id').single();
  if (error || !ticket) redirect('/support?error=We+could+not+open+your+ticket.+Please+try+again.');
  await supabase.from('support_messages').insert({ ticket_id: ticket.id, author_id: user.id, author_type: 'customer', body: message });
  await supabase.from('activity_events').insert({ actor_id: user.id, surface: 'customer', event_type: 'support_ticket_opened', endpoint: '/support', http_method: 'POST', request_status: 201, entity_type: 'support_ticket', entity_id: ticket.id });
  revalidatePath('/support'); revalidatePath('/account'); revalidatePath('/admin/support');
  redirect('/support?success=Your+support+request+is+open.+Our+team+will+reply+in+your+Support+Centre.');
}
