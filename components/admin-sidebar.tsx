'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Bell, Bot, Boxes, Building2, Cable, ChartNoAxesCombined, Headphones,
  ChevronDown, ChevronLeft, ClipboardCheck, FolderKanban, Gift, KeyRound, LayoutTemplate,
  LogOut, Megaphone, Package, PlugZap, ReceiptText, Settings, Share2, ShieldCheck, Store, FileClock,
  Tags, UserPlus, Users, UsersRound, WalletCards,
} from 'lucide-react';

const sections = [
  { title: 'AI COMPANY', icon: Bot, links: [{ label: 'AI Agents', href: '/admin/ai-agents', icon: Bot }, { label: 'Approval Inbox', href: '/admin/approvals', icon: ClipboardCheck }] },
  { title: 'OPERATIONS', icon: ChartNoAxesCombined, links: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: ChartNoAxesCombined }, { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Wallet & Payouts', href: '/admin/wallet', icon: WalletCards }, { label: 'Offers & Rewards', href: '/admin/offers', icon: Gift },
  ] },
  { title: 'CATALOGUE', icon: Store, links: [
    { label: 'Stores & Brands', href: '/admin', icon: Store }, { label: 'Categories', href: '/admin/categories', icon: Boxes },
    { label: 'Products', href: '/admin/products', icon: Package }, { label: 'Deals & Banners', href: '/admin/campaigns', icon: Tags },
    { label: 'Orders & Earnings', href: '/admin/orders', icon: ReceiptText }, { label: 'Reported Orders', href: '/admin/reported-orders', icon: ClipboardCheck },
  ] },
  { title: 'PARTNERS & GROWTH', icon: Cable, links: [
    { label: 'Affiliate Providers', href: '/admin/providers', icon: Cable }, { label: 'API Integrations', href: '/admin/integrations', icon: PlugZap },
    { label: 'Postback Logs', href: '/admin/postbacks', icon: FolderKanban }, { label: 'Ads Manager', href: '/admin/ads', icon: Megaphone },
    { label: 'Ad Platforms', href: '/admin/ad-platforms', icon: PlugZap }, { label: 'Social Accounts', href: '/admin/social-accounts', icon: Share2 },
    { label: 'Social Analytics', href: '/admin/social-analytics', icon: BarChart3 },
  ] },
  { title: 'TEAM & ACCESS', icon: UsersRound, links: [
    { label: 'Employees', href: '/admin/team', icon: UsersRound },
    { label: 'Invite Employee', href: '/admin/team/new', icon: UserPlus },
    { label: 'Departments', href: '/admin/departments', icon: Building2 },
    { label: 'Roles & Permissions', href: '/admin/roles', icon: KeyRound },
    { label: 'Invitations', href: '/admin/invitations', icon: ClipboardCheck },
    { label: 'Access Reviews', href: '/admin/access-reviews', icon: ShieldCheck },
  ] },
  { title: 'WORKSPACE', icon: Settings, links: [
    { label: 'Support Centre', href: '/admin/support', icon: Headphones },
    { label: 'Analytics & Reporting', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Activity & Audit Log', href: '/admin/activity', icon: FileClock },
    { label: 'Website Builder', href: '/admin/cms', icon: LayoutTemplate },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
    { label: 'Sign Out', href: '/admin/logout', icon: LogOut },
  ] },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const sectionOpen = (title: string, links: readonly { href: string }[]) => !collapsed && (expanded === title || (expanded === null && links.some((link) => active(link.href))));

  return <aside ref={sidebarRef} className="admin-side" aria-label="Admin navigation">
    <div className="sidebar-brand-row">
      <a className="admin-brand" href="/admin/dashboard" aria-label="Glonni admin dashboard">
        <span className="brand-mark">G</span>
        <span className="brand-copy"><b>Glonn<i>i</i></b><small>ADMIN CONSOLE</small></span>
      </a>
      <button className="sidebar-toggle" type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggle}><ChevronLeft/></button>
    </div>
    <nav>{sections.map((section) => { const SectionIcon = section.icon; const isOpen = sectionOpen(section.title, section.links); return <section key={section.title} className={isOpen ? 'open' : ''}><button className="nav-group" type="button" title={section.title} onClick={() => setExpanded(isOpen ? null : section.title)}><span><SectionIcon size={16}/><b>{section.title}</b></span><ChevronDown size={15}/></button><div className="nav-links">{section.links.map((link) => { const Icon = link.icon; const isActive = active(link.href); return <a key={link.href} className={isActive ? 'selected' : ''} href={link.href} title={link.label} aria-current={isActive ? 'page' : undefined}><span className="nav-icon"><Icon className="nav-symbol" size={17}/></span><span className="nav-label">{link.label}</span></a>; })}</div></section>; })}</nav>
  </aside>;
}
