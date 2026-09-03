import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BellRing, ExternalLink, MousePointerClick } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import styles from '@/app/customer-shopping/shopping.module.css';

type Props = { searchParams: Promise<{ filter?: string }> };
type Interaction = { id: string; occurred_at: string; event_type: string; endpoint: string | null; metadata: { label?: string } | null };
type RedirectClick = { id: string; created_at: string; offers: { products: { title: string; slug: string } | null; merchants: { name: string } | null } | null };
type TimelineItem = { id: string; kind: 'click' | 'interaction'; time: string; title: string; detail: string; href?: string };

function interactionCopy(row: Interaction) {
  const label = row.metadata?.label?.trim();
  if (label === 'Save deal') return ['Saved a deal', 'Added an offer to your saved deals'];
  if (label?.toLowerCase().includes('alert')) return ['Created or changed a price alert', label];
  return ['Glonni activity', label || row.event_type.replaceAll('_', ' ')];
}

export default async function ShoppingActivityPage({ searchParams }: Props) {
  const { filter = 'all' } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/shopping-activity?filter=${filter}`)}`);
  const [{ data: rawInteractions }, { data: rawClicks }] = await Promise.all([
    supabase.from('activity_events').select('id,occurred_at,event_type,endpoint,metadata').eq('actor_id', user.id).eq('surface', 'customer').order('occurred_at', { ascending: false }).limit(80),
    supabase.from('redirect_events').select('id,created_at,offers(products(title,slug),merchants(name))').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(80),
  ]);
  const interactions = (rawInteractions ?? []) as unknown as Interaction[];
  const clicks = (rawClicks ?? []) as unknown as RedirectClick[];
  const items: TimelineItem[] = [
    ...clicks.map((row) => ({ id: `click-${row.id}`, kind: 'click' as const, time: row.created_at, title: `Visited ${row.offers?.merchants?.name || 'a store'} through Glonni`, detail: row.offers?.products?.title || 'Merchant offer', href: row.offers?.products?.slug ? `/product/${row.offers.products.slug}?from=${encodeURIComponent('/shopping-activity')}` : undefined })),
    ...interactions.map((row) => { const [title, detail] = interactionCopy(row); return { id: `event-${row.id}`, kind: 'interaction' as const, time: row.occurred_at, title, detail }; }),
  ].filter((item) => filter === 'all' || (filter === 'clicks' ? item.kind === 'click' : item.kind === 'interaction')).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return <><Header/><main className={styles.page}>
    <BrowseNav items={[{ label: 'Profile', href: '/account?section=shopping' }, { label: 'My Shopping', href: '/account?section=shopping' }, { label: 'Shopping activity' }]} fallback="/account?section=shopping"/>
    <header className={styles.head}><p>MY SHOPPING</p><h1>Shopping activity</h1><span>A private, read-only record of deals you saved, alerts you set, and store offers you opened through Glonni. A store visit is not a purchase confirmation.</span></header>
    <nav className={styles.filters} aria-label="Activity filters"><Link href="/shopping-activity" className={filter === 'all' ? styles.active : ''}>All activity</Link><Link href="/shopping-activity?filter=interactions" className={filter === 'interactions' ? styles.active : ''}>Saved &amp; alerts</Link><Link href="/shopping-activity?filter=clicks" className={filter === 'clicks' ? styles.active : ''}>Store clicks</Link></nav>
    {items.length ? <section className={styles.timeline}>{items.map((item) => <article key={item.id}>{item.kind === 'click' ? <ExternalLink/> : <MousePointerClick/>}<div>{item.href ? <Link href={item.href}><b>{item.title}</b></Link> : <b>{item.title}</b>}<small>{item.detail}</small></div><time>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.time))}</time></article>)}</section> : <section className={styles.empty}><BellRing size={28}/><h2>No activity in this view</h2><p>When you save a deal, create an alert, or open a merchant offer through Glonni, it will appear here.</p><Link href="/deals">Browse deals</Link></section>}
  </main></>;
}
