import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const money = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const when = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
type WalletEntry = { id: string; amount: number; entry_type: string; note: string | null; created_at: string };
type Withdrawal = { id: string; amount: number; status: string; created_at: string };
type Award = { amount: number; status: string };

export async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await page(from, from + 999);
    if (result.error) return { data: rows, error: result.error };
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return { data: rows, error: null };
  }
}

export async function customerAdminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const [{ data: profile }, { data: employee }, { data: assurance }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') notFound();
  return supabase;
}

export async function customerRecord(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) notFound();
  const supabase = await customerAdminClient();
  const { data: profile, error } = await supabase.from('profiles').select('id,display_name,city,state,avatar_url,role,created_at').eq('id', userId).eq('role', 'customer').maybeSingle();
  if (error || !profile) notFound();
  const [entriesResult, withdrawalsResult, awardsResult, ticketsResult, activityResult, savedResult, alertsResult, clicksResult] = await Promise.all([
    readAll<WalletEntry>((from, to) => supabase.from('wallet_entries').select('id,amount,entry_type,note,created_at').eq('profile_id', userId).order('created_at', { ascending: false }).range(from, to)),
    readAll<Withdrawal>((from, to) => supabase.from('withdrawal_requests').select('id,amount,status,created_at').eq('profile_id', userId).order('created_at', { ascending: false }).range(from, to)),
    readAll<Award>((from, to) => supabase.from('cashback_awards').select('amount,status').eq('profile_id', userId).order('created_at', { ascending: false }).range(from, to)),
    supabase.from('support_tickets').select('id,ticket_number,subject,category,status,priority,created_at,updated_at').eq('profile_id', userId).order('updated_at', { ascending: false }).limit(100),
    supabase.from('activity_events').select('id,occurred_at,event_type,surface,endpoint,request_status').eq('actor_id', userId).order('occurred_at', { ascending: false }).limit(100),
    supabase.from('saved_offers').select('offer_id', { count: 'exact', head: true }).eq('profile_id', userId),
    supabase.from('price_alerts').select('id', { count: 'exact', head: true }).eq('profile_id', userId).eq('is_active', true),
    supabase.from('redirect_events').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
  ]);
  const entries = entriesResult.data ?? [];
  const withdrawals = withdrawalsResult.data ?? [];
  const awards = awardsResult.data ?? [];
  const tickets = ticketsResult.data ?? [];
  const activity = activityResult.data ?? [];
  const pending = awards.filter(row => ['pending', 'held'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount), 0);
  const reserved = withdrawals.filter(row => ['requested', 'on_hold', 'approved', 'batched', 'processing'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount), 0);
  const balance = entries.reduce((sum, row) => sum + Number(row.amount), 0);
  const lifetime = entries.filter(row => row.entry_type === 'cashback_confirmed').reduce((sum, row) => sum + Math.max(0, Number(row.amount)), 0);
  const withdrawn = Math.abs(entries.filter(row => row.entry_type === 'withdrawal_paid').reduce((sum, row) => sum + Number(row.amount), 0));
  const openTickets = tickets.filter(row => !['resolved', 'closed'].includes(row.status));
  return {
    supabase, profile, entries, withdrawals, awards, tickets, activity,
    walletUnavailable: Boolean(entriesResult.error || withdrawalsResult.error || awardsResult.error),
    supportUnavailable: Boolean(ticketsResult.error),
    activityUnavailable: Boolean(activityResult.error),
    wallet: { available: Math.max(0, balance - reserved), pending, lifetime, withdrawn },
    openTickets: openTickets.length,
    lastTicket: tickets[0]?.updated_at ?? null,
    savedCount: savedResult.error ? null : savedResult.count,
    alertCount: alertsResult.error ? null : alertsResult.count,
    clickCount: clicksResult.error ? null : clicksResult.count,
  };
}
