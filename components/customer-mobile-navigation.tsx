'use client';

import { useEffect, useRef, useState } from 'react';
import { Grid2X2, Home, Menu, ShoppingBag, Store, UserRound, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Categories', href: '/#categories', icon: Grid2X2 },
  { label: 'Stores', href: '/stores', icon: Store },
  { label: 'Deals', href: '/deals', icon: ShoppingBag },
  { label: 'Profile', href: '/account', icon: UserRound },
];

export function CustomerMobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    document.body.classList.add('customer-menu-open');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('customer-menu-open');
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="mobile-menu" aria-label="Open navigation menu" aria-expanded={open} aria-controls="customer-mobile-menu" onClick={() => setOpen(true)}><Menu/></button>
    {open && <div className="customer-menu-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside id="customer-mobile-menu" className="customer-mobile-menu" aria-label="Customer navigation">
        <header><a className="logo" href="/" onClick={() => setOpen(false)}>Glonni</a><button type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)}><X/></button></header>
        <div className="customer-mobile-links" role="navigation" aria-label="Main navigation">
          {items.map(({ label, href, icon: Icon }) => {
            const active = label === 'Home' ? pathname === '/' : label === 'Categories' ? false : pathname === href || pathname.startsWith(`${href}/`);
            return <a href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)} key={label}><Icon/><span><b>{label}</b><small>{label === 'Home' ? 'Featured offers and categories' : label === 'Categories' ? 'Browse categories on the homepage' : label === 'Stores' ? 'Browse available merchants' : label === 'Deals' ? 'Search and compare offers' : 'Account, wallet and preferences'}</small></span></a>;
          })}
        </div>
      </aside>
    </div>}
  </>;
}
