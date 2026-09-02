import { MapPin, Menu, Search, ShoppingCart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('display_name,avatar_url,city').eq('id', user.id).maybeSingle() : { data: null };
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Profile';
  const initial = displayName.slice(0, 1).toUpperCase();
  const location = profile?.city || 'Hyderabad';

  return <><header className="top">
    <a className="logo" href="/"><span>Glonn</span><i>i</i><small>✦</small></a>
    <form className="search" action="/deals"><button type="button">All Categories⌄</button><input name="q" placeholder="Search for products, brands and more..."/><button type="submit" aria-label="Search"><Search size={20}/></button></form>
    <div className="top-actions">
      <span className="header-location"><MapPin/><small>Location</small><b>{location}⌄</b></span>
      <span className="header-cart"><ShoppingCart/><b>Cart</b></span>
      <a className="profile-trigger" href="/account" aria-label="Open Profile"><b className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initial}</b><em>Profile</em></a>
    </div>
    <a className="mobile-profile" href="/account" aria-label="Open Profile">{profile?.avatar_url ? <img src={profile.avatar_url} alt=""/> : initial}</a><button className="mobile-menu"><Menu/></button>
  </header><form className="mobile-search" action="/deals"><Search size={18}/><input name="q" placeholder="Search products, brands and more"/></form></>;
}
