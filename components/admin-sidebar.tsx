'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Bell, Bot, Boxes, Building2, Cable, ChartNoAxesCombined,
  ChevronLeft, ClipboardCheck, FolderKanban, Gift, KeyRound, LayoutTemplate,
  LogOut, Package, PlugZap, ReceiptText, Settings, ShieldCheck, Store,
  Tags, UserPlus, Users, UsersRound, WalletCards,
} from 'lucide-react';

const sections = [
  { title: 'AI COMPANY', links: [{ label: 'AI Agents', href: '/admin/ai-agents', icon: Bot }] },
  { title: 'MAIN', links: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: ChartNoAxesCombined },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Wallet & Payouts', href: '/admin/wallet', icon: WalletCards },
    { label: 'Offers & Rewards', href: '/admin/offers', icon: Gift },
  ] },
  { title: 'TEAM & ACCESS', links: [
    { label: 'Employees', href: '/admin/team', icon: UsersRound },
    { label: 'Invite Employee', href: '/admin/team/new', icon: UserPlus },
    { label: 'Departments', href: '/admin/departments', icon: Building2 },
    { label: 'Roles & Permissions', href: '/admin/roles', icon: KeyRound },
    { label: 'Invitations', href: '/admin/invitations', icon: ClipboardCheck },
    { label: 'Access Reviews', href: '/admin/access-reviews', icon: ShieldCheck },
  ] },
  { title: 'SHOP & EARN', links: [
    { label: 'Stores & Brands', href: '/admin', icon: Store },
    { label: 'Categories', href: '/admin/categories', icon: Boxes },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Deals & Banners', href: '/admin/campaigns', icon: Tags },
    { label: 'Orders & Earnings', href: '/admin/orders', icon: ReceiptText },
    { label: 'Reported Orders', href: '/admin/reported-orders', icon: ClipboardCheck },
  ] },
  { title: 'PROVIDERS', links: [
    { label: 'Affiliate Providers', href: '/admin/providers', icon: Cable },
    { label: 'API Integrations', href: '/admin/integrations', icon: PlugZap },
    { label: 'Postback Logs', href: '/admin/postbacks', icon: FolderKanban },
  ] },
  { title: 'MANAGEMENT', links: [
    { label: 'Analytics & Reporting', href: '/admin/analytics', icon: BarChart3 },
    { label: 'CMS', href: '/admin/cms', icon: LayoutTemplate },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
    { label: 'Sign Out', href: '/admin/logout', icon: LogOut },
  ] },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('glonni-admin-sidebar') === 'collapsed');
  }, []);

  useEffect(() => {
    sidebarRef.current?.closest('.admin-v2')?.classList.toggle('sidebar-collapsed', collapsed);
  }, [collapsed]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem('glonni-admin-sidebar', next ? 'collapsed' : 'expanded');
  }

  const active = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/stores/');
    if (href === '/admin/team') return pathname === href || (pathname.startsWith('/admin/team/') && pathname !== '/admin/team/new');
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return <aside ref={sidebarRef} className="admin-side" aria-label="Admin navigation">
    <button className="sidebar-toggle" type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggle}><ChevronLeft/></button>
    <a className="admin-brand" href="/admin/dashboard"><b>Glonn<i>i</i></b><span>Admin Panel</span></a>
    <nav>{sections.map((section) => <section key={section.title}><p>{section.title}</p>{section.links.map((link) => { const Icon = link.icon; return <a key={link.href} className={active(link.href) ? 'selected' : ''} href={link.href}><Icon className="nav-symbol" size={17}/><span className="nav-label">{link.label}</span></a>; })}</section>)}</nav>
  </aside>;
}
