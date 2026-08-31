'use client';
import { useEffect } from 'react';

const sections = [
  ['AI COMPANY', [['✦','AI Agents','/admin/ai-agents']]],
  ['MAIN', [['⌂','Dashboard','/admin/dashboard'],['♙','Users','/admin/users'],['◫','Wallet & Payouts','/admin/wallet'],['♧','Offers & Rewards','/admin/offers']]],
  ['TEAM & ACCESS', [['♟','Employees','/admin/team'],['＋','Invite Employee','/admin/team/new'],['▥','Departments','/admin/departments'],['⚿','Roles & Permissions','/admin/roles'],['✉','Invitations','/admin/invitations'],['✓','Access Reviews','/admin/access-reviews']]],
  ['SHOP & EARN', [['▣','Stores & Brands','/admin'],['▦','Categories','/admin/categories'],['◇','Products','/admin/products'],['♜','Deals & Banners','/admin/campaigns'],['◈','Orders & Earnings','/admin/orders'],['⚑','Reported Orders','/admin/reported-orders']]],
  ['PROVIDERS', [['◌','Affiliate Providers','/admin/providers'],['↔','API Integrations','/admin/integrations'],['⌁','Postback Logs','/admin/postbacks']]],
  ['MANAGEMENT', [['▤','Analytics & Controls','/admin/analytics'],['▧','CMS','/admin/cms'],['♢','Notifications','/admin/notifications'],['⚙','Settings','/admin/settings'],['↪','Sign Out','/admin/logout']]],
] as const;

export function AdminNavigation() {
  useEffect(() => {
    const path = window.location.pathname;
    const active = (href: string) => href === '/admin' ? path === href : path === href || path.startsWith(`${href}/`);
    const markup = `<button class="sidebar-toggle" type="button" aria-label="Toggle sidebar" title="Toggle sidebar">‹</button><a class="admin-brand" href="/"><b>Glonn<i>i</i></b><span>Admin Panel</span></a>${sections.map(([title, links]) => `<section><p>${title}</p>${links.map(([symbol, label, href]) => `<a class="${active(href) ? 'selected' : ''}" href="${href}"><i class="nav-symbol">${symbol}</i><span class="nav-label">${label}</span></a>`).join('')}</section>`).join('')}`;
    document.querySelectorAll<HTMLElement>('.admin-v2').forEach((admin) => {
      const sidebar = admin.querySelector<HTMLElement>('.admin-side');
      if (!sidebar) return;
      sidebar.innerHTML = markup;
      const saved = window.localStorage.getItem('glonni-admin-sidebar');
      if (saved === 'collapsed') admin.classList.add('sidebar-collapsed');
      sidebar.querySelector<HTMLButtonElement>('.sidebar-toggle')?.addEventListener('click', () => {
        const collapsed = admin.classList.toggle('sidebar-collapsed');
        window.localStorage.setItem('glonni-admin-sidebar', collapsed ? 'collapsed' : 'expanded');
      });
    });
  }, []);
  return null;
}
