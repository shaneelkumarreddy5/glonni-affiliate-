import { Bell, Heart, MapPin, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CustomerMobileNavigation } from '@/components/customer-mobile-navigation';

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, savedResult, notificationResult] = await Promise.all([
    user ? supabase.from('profiles').select('display_name,avatar_url,city').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from('saved_offers').select('offer_id', { count: 'exact', head: true }).eq('profile_id', user.id) : Promise.resolve({ count: 0 }),
    user ? supabase.from('customer_notifications').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).is('read_at', null) : Promise.resolve({ count: 0 }),
  ]);
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Profile';
  const initial = displayName.slice(0, 1).toUpperCase();
  const location = profile?.city || 'Location not set';
  const savedCount = savedResult.count ?? 0;
  const unreadNotificationCount = notificationResult.count ?? 0;

  return <><header className="top">
    <a className="logo" href="/" aria-label="Glonni home">Glonni</a>
    <form className="search" action="/deals"><input name="q" aria-label="Search products, brands and stores" placeholder="Search products, brands and stores..."/><button type="submit" aria-label="Search"><Search size={20}/></button></form>
    <div className="top-actions">
      <span className="header-location"><MapPin/><small>Shopping location</small><b>{location}</b></span>
      <a className="header-saved" href="/saved-deals" aria-label={`Saved deals${savedCount ? `, ${savedCount} saved` : ''}`}><Heart/><span><b>Saved</b>{savedCount > 0 && <small>{savedCount > 99 ? '99+' : savedCount}</small>}</span></a>
      {user && <a className="header-notifications" href="/notifications" aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}><Bell/><span><b>Notifications</b>{unreadNotificationCount > 0 && <small>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</small>}</span></a>}
      <a className="profile-trigger" href="/account" aria-label="Open Profile"><b className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initial}</b><em>Profile</em></a>
    </div>
    <a className="mobile-saved" href="/saved-deals" aria-label={`Saved deals${savedCount ? `, ${savedCount} saved` : ''}`}><Heart/>{savedCount > 0 && <small>{savedCount > 99 ? '99+' : savedCount}</small>}</a>
    {user && <a className="mobile-notifications" href="/notifications" aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}><Bell/>{unreadNotificationCount > 0 && <small>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</small>}</a>}
    <a className="mobile-profile" href="/account" aria-label="Open Profile">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initial}</a><CustomerMobileNavigation/>
  </header><form className="mobile-search" action="/deals"><Search size={18}/><input name="q" aria-label="Search products, brands and stores" placeholder="Search products, brands and stores"/><button type="submit" aria-label="Search">Search</button></form></>;
}
