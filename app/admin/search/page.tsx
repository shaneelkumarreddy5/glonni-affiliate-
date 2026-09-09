import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, Building2, Package, Search, Users } from 'lucide-react';

export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content admin-search-page">
    <div className="admin-title"><div><p>ADMIN WORKSPACE</p><h1>Search</h1><span>Find the correct customer, offer, partner or operational record.</span></div></div>
    <form className="admin-search-form" action="/admin/search"><Search/><input name="q" defaultValue={query} autoFocus placeholder="Search users, offers, partners, or activity…"/><button>Search</button></form>
    <p className="preview-note">{query ? <>Showing the available workspaces for “{query}”. Connected record-level search will replace preview matching when live data sources are enabled.</> : 'Enter a name, user ID, offer, provider, merchant or activity reference.'}</p>
    <section className="admin-search-results">
      <a href={`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`}><Users/><span><b>Users</b><small>Customer identity, verification and wallet readiness</small></span>Open →</a>
      <a href={`/admin/offers${query ? `?q=${encodeURIComponent(query)}` : ''}`}><Package/><span><b>Offers &amp; rewards</b><small>Products, eligibility and merchant terms</small></span>Open →</a>
      <a href={`/admin/providers${query ? `?q=${encodeURIComponent(query)}` : ''}`}><Building2/><span><b>Affiliate providers</b><small>Provider connections, policies and readiness</small></span>Open →</a>
      <a href={`/admin/activity${query ? `?q=${encodeURIComponent(query)}` : ''}`}><Activity/><span><b>Activity &amp; audit</b><small>Platform-wide customer, admin and API events</small></span>Open →</a>
    </section>
  </main></section></main>;
}
