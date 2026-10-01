import { Bell, Heart, Search, UserRound, WalletCards } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CustomerMobileNavigation } from '@/components/customer-mobile-navigation';
import styles from './customer-header.module.css';

const outstandingWithdrawalStatuses = ['requested', 'on_hold', 'approved', 'batched', 'processing'];

function formatWalletAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export async function Header() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: identity }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('website_identity').select('site_name,logo_url').eq('id', 1).maybeSingle(),
  ]);
  const [{ data: profile }, savedResult, notificationResult, walletEntriesResult, withdrawalsResult] = await Promise.all([
    user ? supabase.from('profiles').select('display_name,avatar_url').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from('saved_offers').select('offer_id', { count: 'exact', head: true }).eq('profile_id', user.id) : Promise.resolve({ count: 0 }),
    user ? supabase.from('customer_notifications').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).is('read_at', null) : Promise.resolve({ count: 0 }),
    user ? supabase.from('wallet_entries').select('amount,entry_type').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    user ? supabase.from('withdrawal_requests').select('amount,status').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
  ]);
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Profile';
  const initial = displayName.slice(0, 1).toUpperCase();
  const siteName = identity?.site_name || 'Glonni';
  const useGlonniLogo = ['glonni', 'glonni affiliate'].includes(siteName.trim().toLowerCase());
  const savedCount = savedResult.count ?? 0;
  const unreadNotificationCount = notificationResult.count ?? 0;
  const walletAvailable = walletEntriesResult.error || withdrawalsResult.error
    ? null
    : Math.max(
      0,
      (walletEntriesResult.data ?? []).filter((entry) => entry.entry_type !== 'cashback_pending').reduce((total, entry) => total + Number(entry.amount), 0)
        - (withdrawalsResult.data ?? []).filter((withdrawal) => outstandingWithdrawalStatuses.includes(withdrawal.status)).reduce((total, withdrawal) => total + Number(withdrawal.amount), 0),
    );
  const walletLabel = walletAvailable === null ? '—' : formatWalletAmount(walletAvailable);

  return <><header className={`top ${styles.customerHeader}`}>
    <a className="logo" href="/" aria-label={`${siteName} home`}>{identity?.logo_url ? <img className="brand-logo-image" src={identity.logo_url} alt=""/> : useGlonniLogo ? <img className="brand-logo-image" src="/brand/glonni-logo-horizontal-navy.svg" alt=""/> : siteName}</a>
    <form className={`search ${styles.headerSearch}`} action="/deals"><button type="submit" aria-label="Search"><Search size={20}/></button><input name="q" aria-label="Search products, brands and stores" placeholder="Search for products, brands or stores..."/></form>
    <nav className={styles.headerNav} aria-label="Shop navigation">
      <a href="/categories">Categories</a>
      <a href="/stores">Stores</a>
      <a href="/deals">Deals</a>
      <a href="/vouchers-bills">Coupons &amp; Bills</a>
    </nav>
    <div className={`top-actions ${styles.actionBar}`}>
      <a className={`header-saved ${styles.iconAction}`} href="/saved-deals" aria-label={`Saved deals${savedCount ? `, ${savedCount} saved` : ''}`} title="Saved"><span className={styles.actionIcon}><Heart aria-hidden="true"/>{savedCount > 0 && <i className={styles.countBadge}>{savedCount > 99 ? '99+' : savedCount}</i>}</span><b>Saved</b></a>
      {user && <a className={`header-notifications ${styles.iconAction}`} href="/notifications" aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`} title="Notifications"><span className={styles.actionIcon}><Bell aria-hidden="true"/>{unreadNotificationCount > 0 && <i className={styles.countBadge}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</i>}</span><b>Notifications</b></a>}
      {user && <a className={`header-wallet ${styles.iconAction}`} href="/wallet" aria-label={`Wallet balance ${walletLabel}`} title={`Wallet ${walletLabel}`}><span className={styles.actionIcon}><WalletCards aria-hidden="true"/></span><b>Wallet</b></a>}
      <a className={`profile-trigger ${styles.iconAction}`} href="/account" aria-label="Open Profile" title="Profile"><span className={styles.actionIcon}>{profile?.avatar_url ? <img className={styles.profileImage} src={profile.avatar_url} alt=""/> : <UserRound aria-hidden="true"/>}</span><b>Profile</b></a>
    </div>
    <div className={styles.mobileActions}>
      <a className={`mobile-saved ${styles.mobileAction}`} href="/saved-deals" aria-label={`Saved deals${savedCount ? `, ${savedCount} saved` : ''}`} title="Saved"><Heart aria-hidden="true"/>{savedCount > 0 && <i className={styles.countBadge}>{savedCount > 99 ? '99+' : savedCount}</i>}</a>
      {user && <a className={`mobile-notifications ${styles.mobileAction}`} href="/notifications" aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`} title="Notifications"><Bell aria-hidden="true"/>{unreadNotificationCount > 0 && <i className={styles.countBadge}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</i>}</a>}
      {user && <a className={`${styles.mobileAction} ${styles.mobileWallet}`} href="/wallet" aria-label={`Wallet balance ${walletLabel}`} title={`Wallet ${walletLabel}`}><WalletCards aria-hidden="true"/><b>{walletLabel}</b></a>}
      <a className={`mobile-profile ${styles.mobileAction} ${styles.mobileProfile}`} href="/account" aria-label="Open Profile" title="Profile">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initial}</a>
    </div>
    <CustomerMobileNavigation/>
  </header><form className="mobile-search" action="/deals"><Search size={18}/><input name="q" aria-label="Search products, brands and stores" placeholder="Search products, brands and stores"/><button type="submit" aria-label="Search">Search</button></form></>;
}
