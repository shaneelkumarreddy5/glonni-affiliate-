import Link from 'next/link';
import type { ReactNode } from 'react';
import { BellRing, ChevronRight, Headphones, Heart, MapPin, ShieldCheck, WalletCards } from 'lucide-react';
import { Header } from '@/components/header';
import { signOut } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { updatePreferences, updateProfile } from './actions';
import './account.css';

type Props = { searchParams: Promise<{ error?: string; success?: string }> };
type Preference = { favourite_categories: string[]; favourite_stores: string[]; price_drop_alerts: boolean; deal_expiry_alerts: boolean; marketing_updates: boolean } | null;
type Saved = { offer_id: string; alert_type: string; offers: { current_price: number | null; products: { title: string; slug: string; image_url: string | null } | null; merchants: { name: string } | null } | null };
const categories = ['Electronics', 'Fashion', 'Beauty', 'Home & Kitchen', 'Sports & Fitness', 'Groceries'];
const stores = ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'AJIO', 'Meesho', 'Croma'];
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AccountPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: rawProfile }, { data: rawPreferences }, { data: rawSaved }, { data: rawClaims }, { data: rawEntries }] = await Promise.all([
    supabase.from('profiles').select('display_name,avatar_url,city,state').eq('id', user.id).single(),
    supabase.from('customer_preferences').select('*').eq('profile_id', user.id).maybeSingle(),
    supabase.from('saved_offers').select('offer_id,alert_type,offers(id,current_price,products(title,slug,image_url),merchants(name))').order('created_at', { ascending: false }).limit(6),
    supabase.from('cashback_claims').select('status'),
    supabase.from('wallet_entries').select('amount'),
  ]);
  const profile = rawProfile as { display_name: string | null; avatar_url: string | null; city: string | null; state: string | null } | null;
  const preferences = rawPreferences as Preference;
  const saved = (rawSaved ?? []) as unknown as Saved[];
  const name = profile?.display_name || user.email?.split('@')[0] || 'Glonni shopper';
  const initials = name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();
  const location = [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add your location';
  const available = Math.max(0, (rawEntries ?? []).reduce((total: number, entry: { amount: number }) => total + Number(entry.amount), 0));
  const pending = (rawClaims ?? []).filter((claim: { status: string }) => ['submitted', 'needs_info'].includes(claim.status)).length;

  return <><Header/><main className="account-pro">
    <h1 className="account-page-title">My Space</h1>
    <section className="account-hero"><div className="account-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initials}</div><div className="account-identity"><h2>{name}</h2><span><MapPin size={15}/>{location}</span><p className="account-verified"><ShieldCheck size={14}/>Verified member</p></div><div className="account-hero-actions"><Link href="/wallet"><WalletCards size={16}/>Wallet</Link><form action={signOut}><button type="submit">Sign out</button></form></div></section>
    {params.error && <p className="auth-notice error">{params.error}</p>}{params.success && <p className="auth-notice success">{params.success}</p>}
    <section className="account-metrics"><Metric icon={<Heart/>} label="Saved deals" value={String(saved.length)} detail="Your shortlist"/><Metric icon={<BellRing/>} label="Claims in review" value={String(pending)} detail="Awaiting eligibility"/><article><WalletCards/><div><small>Available cashback</small><b>{money(available)}</b><span>Confirmed only</span></div><Link href="/wallet" aria-label="Open wallet"><ChevronRight size={18}/></Link></article></section>
    <section className="account-pro-grid">
      <article className="account-pro-card saved-pro"><CardTitle eyebrow="SAVED DEALS" title="Your shortlist" link="/deals" label="Explore deals"/>{saved.length ? <div className="saved-pro-list">{saved.map((item) => <SavedOffer key={item.offer_id} item={item}/>)}</div> : <div className="account-empty"><Heart size={23}/><b>Start building your shortlist</b><span>Save deals you want to watch, then return here to compare them.</span><Link href="/deals">Explore deals</Link></div>}</article>
      <article className="account-pro-card wallet-pro"><CardTitle eyebrow="CASHBACK & WALLET" title="Keep rewards clear" link="/wallet" label="Open wallet"/><div className="wallet-pro-amount"><span>Confirmed cashback</span><b>{money(available)}</b><small>Only rewards confirmed as eligible are available to withdraw.</small></div><div className="wallet-pro-links"><Link href="/cashback-claim">Report missing cashback</Link><Link href="/cashback-guide">How cashback works</Link></div></article>
      <article className="account-pro-card profile-pro"><CardTitle eyebrow="PROFILE" title="Personal details"/><form action={updateProfile} className="account-form"><label>Your name<input name="displayName" required minLength={2} maxLength={80} defaultValue={name}/></label><label>City<input name="city" maxLength={80} defaultValue={profile?.city || ''} placeholder="Your city"/></label><label>State<input name="state" maxLength={80} defaultValue={profile?.state || ''} placeholder="Your state"/></label><label>Email address<input value={user.email || ''} disabled/></label><button type="submit">Save profile</button></form></article>
      <article className="account-pro-card preferences-pro"><CardTitle eyebrow="DISCOVERY PREFERENCES" title="Show me better deals"/><form action={updatePreferences} className="preferences-form"><PreferenceGroup name="categories" label="Favourite categories" values={categories} selected={preferences?.favourite_categories ?? []}/><PreferenceGroup name="stores" label="Favourite stores" values={stores} selected={preferences?.favourite_stores ?? []}/><fieldset className="preference-toggles"><Toggle name="priceDropAlerts" title="Price-drop alerts" detail="Used when live price monitoring is enabled." checked={preferences?.price_drop_alerts ?? true}/><Toggle name="dealExpiryAlerts" title="Deal-expiry alerts" detail="Keep deal-ending reminders enabled." checked={preferences?.deal_expiry_alerts ?? true}/><Toggle name="marketingUpdates" title="Glonni updates" detail="Optional product news and offers." checked={preferences?.marketing_updates ?? false}/></fieldset><button type="submit">Save preferences</button></form></article>
      <article className="account-pro-card support-pro"><Headphones/><div><p>HELP &amp; SUPPORT</p><h2>Ask Glonni Support</h2><span>Get trusted answers about deals and cashback, or securely reach our team.</span></div><Link href="/support">Get help <ChevronRight size={15}/></Link></article>
    </section>
    <section className="account-pro-footer"><ShieldCheck/><div><b>Your account and rewards are protected</b><span>Glonni credits cashback only after the exact offer is eligible and confirmed. Purchases and delivery remain with the merchant.</span></div><Link href="/help">Help Centre <ChevronRight size={15}/></Link></section>
  </main></>;
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) { return <article>{icon}<div><small>{label}</small><b>{value}</b><span>{detail}</span></div></article>; }
function CardTitle({ eyebrow, title, link, label }: { eyebrow: string; title: string; link?: string; label?: string }) { return <div className="account-card-title"><div><p>{eyebrow}</p><h2>{title}</h2></div>{link && <Link href={link}>{label}<ChevronRight size={15}/></Link>}</div>; }
function SavedOffer({ item }: { item: Saved }) { const offer = item.offers; return <Link href={offer?.products?.slug ? `/product/${offer.products.slug}` : '/deals'}><img src={offer?.products?.image_url || ''} alt=""/><span><small>{offer?.merchants?.name || 'Store'}</small><b>{offer?.products?.title || 'Saved offer'}</b><em>{offer?.current_price ? `₹${offer.current_price.toLocaleString('en-IN')}` : 'View offer'} · {item.alert_type.replace('_', ' ')}</em></span><ChevronRight size={16}/></Link>; }
function PreferenceGroup({ name, label, values, selected }: { name: string; label: string; values: string[]; selected: string[] }) { return <fieldset><legend>{label}</legend><div>{values.map((value) => <label key={value}><input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)}/><span>{value}</span></label>)}</div></fieldset>; }
function Toggle({ name, title, detail, checked }: { name: string; title: string; detail: string; checked: boolean }) { return <label><input type="checkbox" name={name} defaultChecked={checked}/><span><b>{title}</b><small>{detail}</small></span></label>; }
