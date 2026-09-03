import Link from 'next/link';
import { BadgeCheck, BellRing, ChevronRight, CircleAlert, CircleHelp, CreditCard, Headphones, Heart, Landmark, MailCheck, MapPin, Phone, ReceiptText, ShieldCheck, SlidersHorizontal, UserCheck, UserRound, WalletCards } from 'lucide-react';
import { Header } from '@/components/header';
import { signOut } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { updatePreferences, updateProfile } from './actions';
import './account.css';
import './profile-details.css';

type Props = { searchParams: Promise<{ error?: string; success?: string; section?: string }> };
type Preference = { favourite_categories: string[]; favourite_stores: string[]; price_drop_alerts: boolean; deal_expiry_alerts: boolean; marketing_updates: boolean } | null;
type Saved = { offer_id: string; alert_type: string; offers: { current_price: number | null; products: { title: string; slug: string; image_url: string | null } | null; merchants: { name: string } | null } | null };
const categories = ['Electronics', 'Fashion', 'Beauty', 'Home & Kitchen', 'Sports & Fitness', 'Groceries'];
const stores = ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'AJIO', 'Meesho', 'Croma'];
const sections = [
  ['profile', 'Profile', 'Personal details and account identity', UserRound],
  ['wallet', 'Wallet & Payouts', 'Cashback, withdrawal and reward history', WalletCards],
  ['shopping', 'My Shopping', 'Saved deals, alerts and activity', Heart],
  ['preferences', 'Preferences', 'Deals, stores and notifications', SlidersHorizontal],
  ['help', 'Help & Legal', 'Support, FAQs and account documents', CircleHelp],
] as const;
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AccountPage({ searchParams }: Props) {
  const params = await searchParams;
  const active = sections.some(([key]) => key === params.section) ? params.section! : 'profile';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: rawProfile }, { data: rawPreferences }, { data: rawSaved }, { data: rawClaims }, { data: rawEntries }] = await Promise.all([
    supabase.from('profiles').select('display_name,avatar_url,city,state').eq('id', user.id).single(),
    supabase.from('customer_preferences').select('*').eq('profile_id', user.id).maybeSingle(),
    supabase.from('saved_offers').select('offer_id,alert_type,offers(id,current_price,products(title,slug,image_url),merchants(name))').order('created_at', { ascending: false }).limit(8),
    supabase.from('cashback_claims').select('status,claimed_amount'),
    supabase.from('wallet_entries').select('amount'),
  ]);
  const profile = rawProfile as { display_name: string | null; avatar_url: string | null; city: string | null; state: string | null } | null;
  const profileMeta = user.user_metadata as Record<string, unknown>;
  const preferences = rawPreferences as Preference;
  const saved = (rawSaved ?? []) as unknown as Saved[];
  const name = profile?.display_name || user.email?.split('@')[0] || 'Glonni shopper';
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const location = [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add your location';
  const available = Math.max(0, (rawEntries ?? []).reduce((total: number, entry: { amount: number }) => total + Number(entry.amount), 0));
  const pending = (rawClaims ?? []).filter((claim: { status: string }) => ['submitted', 'needs_info'].includes(claim.status)).reduce((total: number, claim: { claimed_amount: number | null }) => total + Number(claim.claimed_amount ?? 0), 0);

  return <><Header/><main className="account-hub">
    <div className="account-breadcrumb"><Link href="/">Home</Link><ChevronRight size={14}/><b>Profile</b></div>
    <section className="profile-identity"><div className="profile-avatar-large">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initials}</div><div><p>GLONNI PROFILE</p><h1>{name}</h1><span><MapPin size={15}/>{location}</span></div><Link href="/account?section=profile" className="profile-edit">Edit profile</Link></section>
    {params.error && <p className="auth-notice error">{params.error}</p>}{params.success && <p className="auth-notice success">{params.success}</p>}
    <div className="account-hub-layout">
      <aside className="account-menu"><p>MY ACCOUNT</p>{sections.map(([key, label, description, Icon]) => <Link href={`/account?section=${key}`} className={active === key ? 'selected' : ''} key={key}><Icon size={19}/><span><b>{label}</b><small>{description}</small></span><ChevronRight size={16}/></Link>)}</aside>
      <section className="account-workspace">{active === 'profile' && <ProfileSection name={name} profile={profile} email={user.email || ''} emailVerified={Boolean(user.email_confirmed_at)} phone={user.phone || ''} meta={profileMeta}/>} {active === 'wallet' && <WalletSection available={available} pending={pending}/>} {active === 'shopping' && <ShoppingSection saved={saved}/>} {active === 'preferences' && <PreferencesSection preferences={preferences}/>} {active === 'help' && <HelpSection/>}</section>
    </div>
  </main></>;
}

function WorkspaceTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) { return <header className="workspace-title"><p>{eyebrow}</p><h2>{title}</h2><span>{body}</span></header>; }
function ProfileSection({ name, profile, email, emailVerified, phone, meta }: { name: string; profile: { city: string | null; state: string | null } | null; email: string; emailVerified: boolean; phone: string; meta: Record<string, unknown> }) {
  const value = (key: string) => typeof meta[key] === 'string' ? meta[key] : '';
  const firstName = value('first_name') || name.split(' ')[0] || '';
  const lastName = value('last_name') || name.split(' ').slice(1).join(' ');
  const addressReady = Boolean(value('address_line1') && profile?.city && profile?.state && value('postal_code'));
  const completion = [firstName, lastName, addressReady, emailVerified, Boolean(phone)].filter(Boolean).length;
  const completionPercent = Math.round((completion / 5) * 100);
  return <><WorkspaceTitle eyebrow="PROFILE" title="Complete your profile" body="Your verified contact and payout details help us protect your account and prepare for withdrawals."/>
    <section className="profile-completion"><div><span>Profile completion</span><b>{completionPercent}%</b></div><div className="profile-progress"><i style={{ width: `${completionPercent}%` }}/></div><small>{completion === 5 ? 'Your profile is ready.' : 'Complete the details below to prepare your account for payouts.'}</small></section>
    <form action={updateProfile} className="profile-form profile-details" encType="multipart/form-data">
      <section className="profile-section"><h3><UserRound/>Personal details</h3><p>Used to identify your Glonni account.</p><label className="avatar-upload">Profile photo<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG or WebP · up to 2 MB</small></label><div className="field-grid"><label>First name<input name="firstName" required minLength={2} maxLength={50} defaultValue={firstName}/></label><label>Last name<input name="lastName" required minLength={1} maxLength={50} defaultValue={lastName}/></label></div></section>
      <section className="profile-section"><h3><MapPin/>Address</h3><p>Required before any payout method can be verified.</p><div className="field-grid"><label className="field-wide">Address line 1<input name="addressLine1" required maxLength={160} defaultValue={value('address_line1')} placeholder="House / flat number, street"/></label><label className="field-wide">Address line 2 <em>Optional</em><input name="addressLine2" maxLength={160} defaultValue={value('address_line2')} placeholder="Area, landmark"/></label><label>City<input name="city" required maxLength={80} defaultValue={profile?.city || ''} placeholder="Your city"/></label><label>State<input name="state" required maxLength={80} defaultValue={profile?.state || ''} placeholder="Your state"/></label><label>PIN code<input name="postalCode" required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} defaultValue={value('postal_code')} placeholder="6-digit PIN code"/></label><label>Country<input value="India" disabled/></label></div></section>
      <section className="profile-section"><h3><BadgeCheck/>Verified contact</h3><p>We show verification only after the address belongs to your authenticated account.</p><div className="verification-grid"><article><MailCheck/><div><b>Email address</b><span>{email || 'No email address'}</span></div><em className={emailVerified ? 'verified' : 'unverified'}>{emailVerified ? <><BadgeCheck/>Verified</> : <><CircleAlert/>Not verified</>}</em></article><article><Phone/><div><b>Mobile number</b><span>{phone || 'No verified number added'}</span></div><em className={phone ? 'verified' : 'unverified'}>{phone ? <><BadgeCheck/>Verified</> : <><CircleAlert/>Verification pending</>}</em></article></div><small className="verification-note">Mobile verification will be enabled after Glonni’s approved SMS provider is connected. We never mark a number as verified without OTP confirmation.</small></section>
      <section className="profile-section"><h3><ShieldCheck/>KYC &amp; payout verification</h3><p>These controls remain safely locked until Glonni connects approved identity and bank verification APIs.</p><div className="verification-grid"><article><UserCheck/><div><b>KYC verification</b><span>Confirm identity before payouts can begin.</span></div><em className="unverified"><CircleAlert/>Not started</em></article><article><CreditCard/><div><b>Bank account / UPI</b><span>Add, verify, choose default or remove payout methods after KYC.</span></div><em className="unverified"><CircleAlert/>KYC required</em></article></div></section>
      <button type="submit">Save profile</button>
    </form><section className="security-note"><ShieldCheck/><div><b>Account security</b><span>Your sign-in session stays on this device until you sign out. Password and account-security changes will be added here.</span></div></section><form action={signOut}><button className="quiet-action" type="submit">Sign out</button></form></>;
}
function WalletSection({ available, pending }: { available: number; pending: number }) { return <><WorkspaceTitle eyebrow="WALLET & PAYOUTS" title="Your cashback and payouts" body="Confirmed cashback, payout requests and rewards history now live together in one place."/><div className="wallet-balance"><div><small>Available to withdraw</small><b>{money(available)}</b><span>Confirmed and eligible</span></div><Link href="/wallet">Open Wallet &amp; Payouts <ChevronRight size={16}/></Link></div><div className="workspace-cards"><Link href="/wallet?tab=transactions"><ReceiptText/><span><b>Transaction history</b><small>View cashback credits, reversals and claim status.</small></span><ChevronRight size={16}/></Link><Link href="/wallet?tab=withdrawals"><Landmark/><span><b>Withdrawal history</b><small>View requests and payout status.</small></span><ChevronRight size={16}/></Link><Link href="/cashback-claim"><BellRing/><span><b>Missing cashback claims</b><small>{money(pending)} currently in review.</small></span><ChevronRight size={16}/></Link></div></>; }
function ShoppingSection({ saved }: { saved: Saved[] }) { return <><WorkspaceTitle eyebrow="MY SHOPPING" title="Your deals and activity" body="Keep track of saved items, price alerts, and the stores you explore."/><div className="workspace-cards shopping-cards"><Link href="/deals"><Heart/><span><b>Saved deals</b><small>{saved.length} deal{saved.length === 1 ? '' : 's'} saved for later.</small></span><ChevronRight size={16}/></Link><Link href="/deals"><BellRing/><span><b>Price alerts</b><small>Manage price-drop and deal-expiry reminders.</small></span><ChevronRight size={16}/></Link><Link href="/stores"><ReceiptText/><span><b>Shopping activity</b><small>Review stores and products you explored.</small></span><ChevronRight size={16}/></Link></div>{saved.length > 0 && <div className="saved-list">{saved.map((item) => <Link href={item.offers?.products?.slug ? `/product/${item.offers.products.slug}?from=${encodeURIComponent('/account?section=shopping')}` : '/deals'} key={item.offer_id}><img src={item.offers?.products?.image_url || ''} alt=""/><span><small>{item.offers?.merchants?.name || 'Store'}</small><b>{item.offers?.products?.title || 'Saved offer'}</b></span><ChevronRight size={16}/></Link>)}</div>}</>; }
function PreferencesSection({ preferences }: { preferences: Preference }) { return <><WorkspaceTitle eyebrow="PREFERENCES" title="Make Glonni work for you" body="Choose what you want to follow and which updates you receive."/><form action={updatePreferences} className="preferences-form profile-preferences"><PreferenceGroup name="categories" label="Favourite categories" values={categories} selected={preferences?.favourite_categories ?? []}/><PreferenceGroup name="stores" label="Favourite stores" values={stores} selected={preferences?.favourite_stores ?? []}/><fieldset className="preference-toggles"><Toggle name="priceDropAlerts" title="Price-drop alerts" detail="Used when live price monitoring is enabled." checked={preferences?.price_drop_alerts ?? true}/><Toggle name="dealExpiryAlerts" title="Deal-expiry alerts" detail="Keep deal-ending reminders enabled." checked={preferences?.deal_expiry_alerts ?? true}/><Toggle name="marketingUpdates" title="Glonni updates" detail="Optional product news and offers." checked={preferences?.marketing_updates ?? false}/></fieldset><button type="submit">Save preferences</button></form></>; }
function HelpSection() { return <><WorkspaceTitle eyebrow="HELP & LEGAL" title="Support and account information" body="Start with Glonni’s assistant, then escalate to a person whenever your issue requires it."/><div className="workspace-cards"><Link href="/support"><Headphones/><span><b>Help & Support</b><small>Ask the assistant or open a support request.</small></span><ChevronRight size={16}/></Link><Link href="/help"><CircleHelp/><span><b>Frequently asked questions</b><small>Find answers about deals and cashback.</small></span><ChevronRight size={16}/></Link><Link href="/privacy"><ShieldCheck/><span><b>Privacy, terms & disclosure</b><small>Read how Glonni handles your account and affiliate links.</small></span><ChevronRight size={16}/></Link></div></>; }
function PreferenceGroup({ name, label, values, selected }: { name: string; label: string; values: string[]; selected: string[] }) { return <fieldset><legend>{label}</legend><div>{values.map((value) => <label key={value}><input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)}/><span>{value}</span></label>)}</div></fieldset>; }
function Toggle({ name, title, detail, checked }: { name: string; title: string; detail: string; checked: boolean }) { return <label><input type="checkbox" name={name} defaultChecked={checked}/><span><b>{title}</b><small>{detail}</small></span></label>; }
