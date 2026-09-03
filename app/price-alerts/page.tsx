import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BellRing } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import { removePriceAlert, togglePriceAlert } from '@/app/customer-shopping/actions';
import styles from '@/app/customer-shopping/shopping.module.css';

type AlertRow = { id: string; alert_type: 'target_price' | 'deal_expiry'; target_price: number | null; is_active: boolean; created_at: string; offers: { current_price: number | null; products: { title: string; slug: string; image_url: string | null } | null; merchants: { name: string } | null } | null };
const money = (value: number | null) => value === null ? 'Price at store' : `₹${Number(value).toLocaleString('en-IN')}`;

export default async function PriceAlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/price-alerts');
  const { data } = await supabase.from('price_alerts').select('id,alert_type,target_price,is_active,created_at,offers(current_price,products(title,slug,image_url),merchants(name))').eq('profile_id', user.id).order('created_at', { ascending: false });
  const alerts = (data ?? []) as unknown as AlertRow[];

  return <><Header/><main className={styles.page}>
    <BrowseNav items={[{ label: 'Profile', href: '/account?section=shopping' }, { label: 'My Shopping', href: '/account?section=shopping' }, { label: 'Price alerts' }]} fallback="/account?section=shopping"/>
    <header className={styles.head}><p>MY SHOPPING</p><h1>Price alerts</h1><span>Manage the target-price and deal-expiry reminders you created. Alerts are saved now and will send notifications once live price feeds are connected.</span></header>
    {alerts.length ? <section className={styles.list}>{alerts.map((alert) => {
      const offer = alert.offers; const product = offer?.products; const href = product?.slug ? `/product/${product.slug}?from=${encodeURIComponent('/price-alerts')}` : '/deals';
      const rule = alert.alert_type === 'target_price' ? `Tell me at ${money(alert.target_price)}` : 'Remind me before this deal may end';
      return <article className={styles.card} key={alert.id}><Link href={href}><img src={product?.image_url || ''} alt={product?.title || 'Alert'}/></Link><div><small>{offer?.merchants?.name || 'Store'}</small><h2>{product?.title || 'Deal alert'}</h2><div className={styles.alertMeta}><span>{rule}</span><span className={alert.is_active ? '' : styles.off}>{alert.is_active ? 'Active' : 'Paused'}</span></div><b>Currently {money(offer?.current_price ?? null)}</b></div><div className={styles.actions}><Link href={href}>View deal</Link><form action={togglePriceAlert}><input type="hidden" name="id" value={alert.id}/><input type="hidden" name="isActive" value={String(alert.is_active)}/><button type="submit">{alert.is_active ? 'Pause' : 'Resume'}</button></form><form action={removePriceAlert}><input type="hidden" name="id" value={alert.id}/><button type="submit">Remove</button></form></div></article>;
    })}</section> : <section className={styles.empty}><BellRing size={28}/><h2>No price alerts yet</h2><p>Open a product, then select Set price alert to create a target-price or deal-expiry reminder.</p><Link href="/deals">Browse deals</Link></section>}
  </main></>;
}
