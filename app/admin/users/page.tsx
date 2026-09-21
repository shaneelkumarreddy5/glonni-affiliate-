import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Headphones, Search, Users, WalletCards } from 'lucide-react';
import { customerAdminClient, money, readAll, when } from '@/lib/admin-customers';

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = q?.trim().toLowerCase() || '';
  const supabase = await customerAdminClient();
  let peopleQuery = supabase.from('profiles').select('id,display_name,city,state,created_at', { count: 'exact' }).eq('role', 'customer');
  if (search) peopleQuery = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(search) ? peopleQuery.eq('id', search) : peopleQuery.ilike('display_name', `%${search.replace(/[%,()]/g, '')}%`);
  const { data, count, error } = await peopleQuery.order('created_at', { ascending: false }).limit(100);
  const people = data ?? [];
  const ids = people.map(person => person.id);
  const [{ data: entries, error: walletError }, { data: tickets, error: supportError }] = ids.length ? await Promise.all([
    readAll<{ profile_id: string; amount: number }>((from, to) => supabase.from('wallet_entries').select('profile_id,amount').in('profile_id', ids).order('created_at', { ascending: false }).range(from, to)),
    readAll<{ profile_id: string; status: string }>((from, to) => supabase.from('support_tickets').select('profile_id,status').in('profile_id', ids).order('updated_at', { ascending: false }).range(from, to)),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const filtered = people;
  const openCases = (tickets ?? []).filter(ticket => !['closed', 'resolved'].includes(ticket.status)).length;
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content users-page">
    <div className="admin-title"><div><p>CUSTOMER MANAGEMENT</p><h1>Customers</h1><span>Customer profiles, wallet records and support cases from this workspace.</span></div></div>
    <section className="admin-stats">
      <article><Users/><div><small>Registered customers</small><b>{error ? 'Unavailable' : count ?? 0}</b><em>Customer profiles</em></div></article>
      <article><WalletCards/><div><small>Wallet records</small><b>{walletError ? 'Unavailable' : entries?.length ?? 0}</b><em>For the displayed customers</em></div></article>
      <article><Headphones/><div><small>Open support cases</small><b>{supportError ? 'Unavailable' : openCases}</b><em>For the displayed customers</em></div></article>
    </section>
    <article className="store-table users-directory"><div className="table-head"><div><span className="current">All customers</span></div><form action="/admin/users"><Search size={15}/><input name="q" defaultValue={q || ''} placeholder="Search name or customer ID"/><button type="submit">Search</button></form></div>
      <div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>LOCATION</th><th>JOINED</th><th>WALLET BALANCE</th><th>OPEN CASES</th><th>ACTION</th></tr></thead><tbody>{filtered.map(person => { const name = person.display_name?.trim() || 'Unnamed customer'; const balance = (entries ?? []).filter(entry => entry.profile_id === person.id).reduce((sum, entry) => sum + Number(entry.amount), 0); const cases = (tickets ?? []).filter(ticket => ticket.profile_id === person.id && !['closed', 'resolved'].includes(ticket.status)).length; return <tr key={person.id}><td><b className="store-initial">{name[0].toUpperCase()}</b><span><strong>{name}</strong><small>{person.id}</small></span></td><td>{[person.city, person.state].filter(Boolean).join(', ') || 'Not provided'}</td><td>{when(person.created_at)}</td><td>{walletError ? 'Unavailable' : money(Math.max(0, balance))}</td><td>{supportError ? 'Unavailable' : cases}</td><td><Link href={`/admin/users/${person.id}`}>View profile</Link></td></tr>; })}{!filtered.length && <tr><td colSpan={6}>{error ? 'Customer records could not be loaded.' : 'No customers match this search.'}</td></tr>}</tbody></table></div>
      <footer>Showing {filtered.length} of {count ?? people.length} matching customer profiles (latest 100). Only recorded customer data is shown.</footer></article>
  </main></section></main>;
}
