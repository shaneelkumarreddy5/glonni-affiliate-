'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function markNotificationRead(formData: FormData) {
  const id = String(formData.get('notificationId') ?? '');
  if (!id) redirect('/notifications?error=Notification+not+found');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/notifications')}`);
  const { error } = await supabase.from('customer_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('profile_id', user.id).is('read_at', null);
  if (error) redirect('/notifications?error=Could+not+update+notification');
  revalidatePath('/notifications');
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/notifications')}`);
  const { error } = await supabase.from('customer_notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', user.id).is('read_at', null);
  if (error) redirect('/notifications?error=Could+not+update+notifications');
  revalidatePath('/notifications');
  redirect('/notifications?success=All+notifications+marked+as+read');
}
