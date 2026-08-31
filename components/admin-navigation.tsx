'use client';
import { useEffect } from 'react';

const sections = [
  ['MAIN', [['⌂','Dashboard','/admin/dashboard'],['♙','Users','/admin/users'],['◫','Wallet & Payouts','/admin/wallet'],['♧','Offers & Rewards','/admin/offers']]],
  ['SHOP & EARN', [['▣','Stores & Brands','/admin'],['▦','Categories','/admin/categories'],['◇','Products','/admin/products'],['♜','Deals & Banners','/admin/campaigns'],['◈','Orders & Earnings','/admin/orders'],['⚑','Reported Orders','/admin/reported-orders']]],
  ['PROVIDERS', [['◌','Affiliate Providers','/admin/providers'],['↔','API Integrations','/admin/integrations'],['⌁','Postback Logs','/admin/postbacks']]],
  ['MANAGEMENT', [['▤','Analytics & Controls','/admin/analytics'],['▧','CMS','/admin/cms'],['♢','Notifications','/admin/notifications'],['⚙','Settings','/admin/settings']]],
] as const;

export function AdminNavigation() {
  useEffect(() => {
    const path = window.location.pathname;
    const active = (href: string) => href === '/admin' ? path === href : path === href || path.startsWith(`${href}/`);
    const markup = `<a class="admin-brand" href="/"><b>Glonn<i>i</i></b><span>Admin Panel</span></a>${sections.map(([title, links]) => `<section><p>${title}</p>${links.map(([symbol, label, href]) => `<a class="${active(href) ? 'selected' : ''}" href="${href}"><i class="nav-symbol">${symbol}</i>${label}</a>`).join('')}</section>`).join('')}`;
    document.querySelectorAll<HTMLElement>('.admin-v2 .admin-side').forEach((element) => { element.innerHTML = markup; });
  }, []);
  return null;
}
