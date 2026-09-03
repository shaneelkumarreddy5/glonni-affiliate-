import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Heart } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import { removeSavedOffer } from '@/app/customer-shopping/actions';
import styles from '@/app/customer-shopping/shopping.module.css';

type SavedRow = { offer_id: string; created_at: string; offers: { id: string; current_price: number | null; products: { title: string; slug: string; image_url: string | null } | null; merchants: { name: string } | null } | null };
const money = (value: number | null) => value === null ? 'Price available at store' : `₹${Number(value).toLocaleString('en-IN')}`;

export default async function SavedDealsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/saved-deals');
  const { data } = await supabase.from('saved_offers').select('offer_id,created_at,offers(id,current_price,products(title,slug,image_url),merchants(name))').eq('profile_id', user.id).order('created_at', { ascending: false });
  const saved = (data ?? []) as unknown as SavedRow[];

  return <><Header/><main className={styles.page}>
    <BrowseNav items={[{ label: 'Profile', href: '/account?section=shopping' }, { label: 'My Shopping', href: '/account?section=shopping' }, { label: 'Saved deals' }]} fallback="/account?section=shopping"/>
    <header className={styles.head}><p>MY SHOPPING</p><h1>Saved deals</h1><span>Keep offers here while you compare. Opening an offer takes you to its product page; Back returns you here.</span></header>
    {saved.length ? <section className={styles.list}>{saved.map((item) => {
      const offer = item.offers; const product = offer?.products; const href = product?.slug ? `/product/${product.slug}?from=${encodeURIComponent('/saved-deals')}` : '/deals';
      return <article className={styles.card} key={item.offer_id}><Link href={href}><img src={product?.image_url || ''} alt={product?.title || 'Saved deal'}/></Link><div><small>{offer?.merchants?.name || 'Store'}</small><h2>{product?.title || 'Saved offer'}</h2><b>{money(offer?.current_price ?? null)}</b><em>Saved {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(item.created_at))}</em></div><div className={styles.actions}><Link href={href}>View deal</Link><form action={removeSavedOffer}><input type="hidden" name="offerId" value={item.offer_id}/><button type="submit">Remove</button></form></div></article>;
    })}</section> : <section className={styles.empty}><Heart size={28}/><h2>No saved deals yet</h2><p>Use the Save deal button on any product card or offer comparison to keep it here.</p><Link href="/deals">Explore deals</Link></section>}
  </main></>;
}
