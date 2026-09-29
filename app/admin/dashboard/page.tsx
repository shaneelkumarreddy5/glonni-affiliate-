import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { Activity, ArrowRight, Package, Store, Users, WalletCards } from 'lucide-react';

export const dynamic = 'force-dynamic';

type DashboardEvent = {
  id: string;
  occurred_at: string;
  event_type: string;
  surface: string | null;
};

const money = (value: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
const number = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);

function currentIndiaMonthStart() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return new Date(Date.UTC(year, month - 1, 1) - 330 * 60_000).toISOString();
}

function timeAgo(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed)) return 'Recently';
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function activityIcon(eventType: string) {
  const type = eventType.toLowerCase();
  if (type.includes('merchant') || type.includes('store')) return <Store size={19} aria-hidden="true"/>;
  if (type.includes('cashback') || type.includes('wallet') || type.includes('withdraw')) return <WalletCards size={19} aria-hidden="true"/>;
  if (type.includes('product') || type.includes('offer')) return <Package size={19} aria-hidden="true"/>;
  if (type.includes('user') || type.includes('profile') || type.includes('member')) return <Users size={19} aria-hidden="true"/>;
  return <Activity size={19} aria-hidden="true"/>;
}

async function loadPaidWithdrawals(supabase: Awaited<ReturnType<typeof createClient>>, monthStart: string) {
  const pageSize = 1000;
  const rows: Array<{ amount: number | string }> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('amount')
      .eq('status', 'paid')
      .gte('updated_at', monthStart)
      .range(offset, offset + pageSize - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export default async function Dashboard() {
  const supabase = await createClient();
  const monthStart = currentIndiaMonthStart();
  const [
    { count: productCount },
    { data: merchants, count: merchantCount },
    { count: memberCount },
    payouts,
    { data: clicks },
    { data: conversions },
    { data: events, error: eventError },
  ] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('merchants').select('id,name,slug', { count: 'exact' }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    loadPaidWithdrawals(supabase, monthStart),
    supabase.from('redirect_events').select('id,merchant_id').order('created_at', { ascending: false }).limit(1000),
    supabase.from('referral_conversions').select('id,merchant_id,status,cashback_amount').eq('status', 'confirmed').order('created_at', { ascending: false }).limit(1000),
    supabase.from('activity_events').select('id,occurred_at,event_type,surface').order('occurred_at', { ascending: false }).limit(5),
  ]);

  const storeStats = new Map<string, { name: string; slug: string; clicks: number; cashback: number }>();
  for (const merchant of merchants ?? []) {
    storeStats.set(merchant.id, { name: merchant.name, slug: merchant.slug, clicks: 0, cashback: 0 });
  }
  for (const click of clicks ?? []) {
    const store = click.merchant_id ? storeStats.get(click.merchant_id) : undefined;
    if (store) store.clicks += 1;
  }
  for (const conversion of conversions ?? []) {
    const store = conversion.merchant_id ? storeStats.get(conversion.merchant_id) : undefined;
    if (store) store.cashback += Number(conversion.cashback_amount ?? 0);
  }
  const topStores = [...storeStats.values()]
    .filter((store) => store.clicks || store.cashback)
    .sort((a, b) => b.clicks - a.clicks || b.cashback - a.cashback)
    .slice(0, 4);
  const recentEvents = (events ?? []) as DashboardEvent[];
  const paidTotal = (payouts ?? []).reduce((total, payout) => total + Number(payout.amount ?? 0), 0);

  const metrics = [
    { label: 'Active products', value: productCount === null ? '—' : number(productCount), note: productCount === null ? 'Catalogue data unavailable' : 'Live in the catalogue', href: '/admin/products' },
    { label: 'Active stores', value: merchantCount === null ? '—' : number(merchantCount), note: merchantCount === null ? 'Store data unavailable' : 'Visible to customers', href: '/admin' },
    { label: 'Members', value: memberCount === null ? '—' : number(memberCount), note: memberCount === null ? 'Member data unavailable' : 'Registered accounts', href: '/admin/users' },
    { label: 'Cashback paid this month', value: payouts ? money(paidTotal) : '—', note: payouts ? 'Completed withdrawals' : 'Payout data unavailable', href: '/admin/wallet' },
  ];

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content dashboard-overview">
    <section className="dashboard-kpis" aria-label="Business overview">
      {metrics.map((metric) => <Link href={metric.href} className="dashboard-kpi" key={metric.label}>
        <span className="dashboard-kpi-label">{metric.label}</span>
        <b>{metric.value}</b>
        <small>{metric.note}<ArrowRight size={13} aria-hidden="true"/></small>
      </Link>)}
    </section>

    <section className="dashboard-grid dashboard-primary-grid">
      <article className="dashboard-panel dashboard-stores-panel">
        <div className="dashboard-panel-title">
          <div><span>Top performing stores</span><p>Recent tracked clicks and confirmed cashback</p></div>
          <Link className="dashboard-view-all" href="/admin">View all<ArrowRight size={14}/></Link>
        </div>
        {topStores.length ? <div className="dashboard-store-list">
          {topStores.map((store) => <Link href={`/admin/stores/${encodeURIComponent(store.slug)}`} className="dashboard-store-row" key={store.slug}>
            <b>{store.name}</b><span>{number(store.clicks)} clicks</span><strong>{money(store.cashback)}</strong>
          </Link>)}
        </div> : <div className="dashboard-empty">{merchants === null || clicks === null || conversions === null ? 'Store activity is temporarily unavailable.' : 'Tracked store activity will appear here.'}</div>}
      </article>

      <article className="dashboard-panel dashboard-recent-panel">
        <div className="dashboard-panel-title">
          <div><span>Recent activity</span><p>Latest customer, admin and API events</p></div>
          <Link className="dashboard-view-all" href="/admin/activity">View all<ArrowRight size={14}/></Link>
        </div>
        {recentEvents.length ? <div className="dashboard-recent-list">
          {recentEvents.map((event) => <Link href="/admin/activity" className="dashboard-recent-row" key={event.id}>
            <i>{activityIcon(event.event_type)}</i>
            <span><b>{event.event_type.replaceAll('_', ' ')}</b><small>{event.surface || 'Activity recorded'}</small></span>
            <time dateTime={event.occurred_at}>{timeAgo(event.occurred_at)}</time>
          </Link>)}
        </div> : <div className="dashboard-empty">{eventError ? 'Activity data is temporarily unavailable.' : 'New activity will appear here as the workspace is used.'}</div>}
      </article>
    </section>
  </main></section></main>;
}
