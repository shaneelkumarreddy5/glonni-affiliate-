import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { CuelinksConnection } from '@/components/cuelinks-connection';
import { registerCuelinksProvider } from '@/app/admin/provider-actions';
import { createClient } from '@/lib/supabase/server';
import { Cable, Clock3, CreditCard, Bot } from 'lucide-react';
import './integrations.css';

export const dynamic = 'force-dynamic';
export default async function IntegrationsPage() {
  const supabase = await createClient();
  const [ai, providers, feeds, payments, { data: { user } }, { data: assurance }] = await Promise.all([
    supabase.from('ai_provider_connections').select('provider_key,display_name,connection_status').order('display_name'),
    supabase.from('affiliate_providers').select('id,name,adapter_key,is_active').order('name'),
    supabase.from('product_feeds').select('id,name,status,next_run_at').order('name'),
    supabase.from('payment_provider_configs').select('id,name,enabled,adapter_status,credential_status,last_health_check_status,last_health_check_at').order('name'),
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const [{ data: profile }, { data: employee }] = user ? await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const canTest = Boolean(profile && ['owner', 'admin'].includes(profile.role) && employee?.status === 'active' && assurance?.currentLevel === 'aal2');
  const rows = [
    ...(ai.data ?? []).map(row => ({ id: 'ai:' + row.provider_key, name: row.display_name, type: 'AI', status: row.connection_status.replaceAll('_', ' '), detail: 'Stored connection state; not a live test', href: '/admin/ai-providers' })),
    ...(providers.data ?? []).map(row => ({ id: row.id, name: row.name, type: 'Affiliate network', status: row.is_active ? 'Active registry record' : 'Inactive', detail: row.adapter_key || 'Adapter not selected', href: '/admin/providers' })),
    ...(feeds.data ?? []).map(row => ({ id: row.id, name: row.name, type: 'Product feed', status: row.status.replaceAll('_', ' '), detail: row.next_run_at ? 'Next run: ' + new Date(row.next_run_at).toLocaleString('en-IN') : 'No next run scheduled', href: '/admin/products?view=feeds' })),
    ...(payments.data ?? []).map(row => ({ id: row.id, name: row.name, type: 'Payment provider', status: row.enabled ? 'Enabled configuration' : 'Disabled', detail: 'Adapter: ' + row.adapter_status + ' · Credentials: ' + row.credential_status + ' · Last check: ' + (row.last_health_check_status || 'Not tested'), href: '/admin/payment-providers' })),
  ];
  const stats = [
    { title: 'AI connections', value: ai.error ? '—' : (ai.data ?? []).filter(row => row.connection_status === 'connected').length, note: 'Recorded connected status', icon: Bot },
    { title: 'Affiliate providers', value: providers.error ? '—' : (providers.data ?? []).length, note: 'Configured registry records', icon: Cable },
    { title: 'Scheduled feeds', value: feeds.error ? '—' : (feeds.data ?? []).filter(row => row.status === 'active' && row.next_run_at).length, note: 'Active with a next-run date', icon: Clock3 },
    { title: 'Payment configurations', value: payments.error ? '—' : (payments.data ?? []).length, note: 'Not proof of live payment access', icon: CreditCard },
  ];
  const failed = ai.error || providers.error || feeds.error || payments.error;
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content">
    <div className="admin-title"><div><p>INTEGRATION WORKBENCH</p><h1>API Integrations</h1><span>Saved configurations and explicit connection checks. Nothing is automatically imported or published.</span></div></div>
    {failed && <p className="preview-note" role="alert">Some connection records could not be loaded. Unavailable counts are shown as a dash; refresh to retry.</p>}
    <section className="admin-stats">{stats.map(({ title, value, note, icon: Icon }) => <article key={title}><Icon/><div><small>{title}</small><b>{value}</b><em>{note}</em></div></article>)}</section>
    <CuelinksConnection canTest={canTest}/>
    {!providers.error && !(providers.data ?? []).some(row => row.adapter_key === 'cuelinks') && <article className="integration-connector"><h2>Add Cuelinks to the provider registry</h2><p>The stored key already passed live campaign and offer reads. Register Cuelinks once so offer records can use it; this does not import or publish any campaign or product.</p>{canTest ? <form action={registerCuelinksProvider}><button className="integration-primary">Add Cuelinks provider</button></form> : <p>Sign in as an active Owner/Admin and complete two-step verification to register this provider.</p>}</article>}
    <article className="store-table"><div className="table-head"><h2>Saved service configurations</h2></div><div className="table-scroll"><table><thead><tr><th>SERVICE</th><th>TYPE</th><th>RECORDED STATUS</th><th>DETAIL</th><th>SETTINGS</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.type}</td><td>{row.status}</td><td>{row.detail}</td><td><Link href={row.href}>Manage</Link></td></tr>)}{!rows.length && <tr><td colSpan={5}>{failed ? 'Configurations unavailable.' : 'No service configurations have been saved yet.'}</td></tr>}</tbody></table></div><footer>Provider secrets stay in server-side secret storage. A saved status is not a successful test, and a successful read is not a catalogue import.</footer></article>
    <article className="integration-connector"><h2>Other launch connections</h2><p>Mobile OTP and email delivery are configured separately from affiliate feeds.</p><div className="integration-buttons"><Link href="https://supabase.com/dashboard/project/abtljhbmdgzvyqbuyefq/auth/providers" target="_blank" rel="noreferrer">Supabase login settings ↗</Link><Link href="/admin/notifications">Notification templates</Link><Link href="/admin/support">Support Centre</Link></div></article>
  </main></section></main>;
}
