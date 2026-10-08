'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Bell, Bot, Boxes, Building2, BriefcaseBusiness, Cable, ChartNoAxesCombined, Clock3, Headphones,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, FolderKanban, Gift, KeyRound,
  LogOut, Megaphone, Package, PlugZap, ReceiptText, Search, Settings, Share2, ShieldCheck, Store, FileClock, Scale, GitCompareArrows,
  Tags, UserPlus, Users, UsersRound, WalletCards, Award, Banknote, CreditCard, FlaskConical, FileSearch, ShoppingBag, PenTool,
} from 'lucide-react';
import { AdminTabRepair } from '@/components/admin-tab-repair';
import { AdminActionRepair } from '@/components/admin-action-repair';
import { CampaignUiRepair } from '@/components/campaign-ui-repair';
import type { LucideIcon } from 'lucide-react';

const sections = [
  { title: 'AI COMPANY', icon: Bot, links: [
    { label: 'AI Agents', href: '/admin/ai-agents', icon: Bot },
    { label: 'CEO & Operations Manager', href: '/admin/ai-agents/ceo-operations', icon: Building2 },
    { label: 'Affiliate Partnerships', href: '/admin/ai-agents/affiliate-partnerships', icon: BriefcaseBusiness },
    { label: 'Provider Policy & Compliance', href: '/admin/ai-agents/provider-compliance', icon: FileSearch },
    { label: 'Catalogue & Merchandising', href: '/admin/ai-agents/catalogue-merchandising', icon: ShoppingBag },
    { label: 'Content & Experience', href: '/admin/ai-agents/content-experience', icon: PenTool },
    { label: 'Marketing Manager', href: '/admin/ai-agents/marketing', icon: Megaphone },
    { label: 'Finance, Cashback & Risk', href: '/admin/ai-agents/finance-cashback-risk', icon: Banknote },
    { label: 'Fraud & Security', href: '/admin/ai-agents/fraud-security', icon: ShieldCheck },
    { label: 'Customer Operations & Trust', href: '/admin/ai-agents/customer-operations', icon: UsersRound },
    { label: 'AI Providers', href: '/admin/ai-providers', icon: Cable },
    { label: 'AI Quality Control', href: '/admin/ai-quality', icon: FlaskConical }, { label: 'Product Freshness', href: '/admin/product-freshness', icon: Clock3 }, { label: 'Change Approvals', href: '/admin/product-changes', icon: GitCompareArrows }] },
  { title: 'OPERATIONS', icon: ChartNoAxesCombined, links: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: ChartNoAxesCombined }, { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Wallet & Payouts', href: '/admin/wallet', icon: WalletCards }, { label: 'Payout Operations', href: '/admin/payout-operations', icon: Banknote }, { label: 'Payment Providers', href: '/admin/payment-providers', icon: CreditCard }, { label: 'Offers & Rewards', href: '/admin/offers', icon: Gift }, { label: 'Finance & Tax', href: '/admin/finance-tax', icon: ReceiptText },
  ] },
  { title: 'CATALOGUE', icon: Store, links: [
    { label: 'Stores & Brands', href: '/admin', icon: Store }, { label: 'Categories', href: '/admin/categories', icon: Boxes },
    { label: 'Products', href: '/admin/products', icon: Package }, { label: 'Deals & Banners', href: '/admin/campaigns', icon: Tags },
    { label: 'Orders & Earnings', href: '/admin/orders', icon: ReceiptText }, { label: 'Financial Validation', href: '/admin/reconciliation', icon: Scale }, { label: 'Cashback Operations', href: '/admin/cashback-operations', icon: Award }, { label: 'Reported Orders', href: '/admin/reported-orders', icon: ClipboardCheck },
  ] },
  { title: 'PARTNERS & GROWTH', icon: Cable, links: [
    { label: 'Affiliate Providers', href: '/admin/providers', icon: Cable }, { label: 'API Integrations', href: '/admin/integrations', icon: PlugZap },
    { label: 'Vouchers & Bills', href: '/admin/vouchers-bills', icon: Gift },
    { label: 'Postback Logs', href: '/admin/postbacks', icon: FolderKanban },
    { label: 'Ads Manager', href: '/admin/ads', icon: Megaphone },
    { label: 'Social Media Manager', href: '/admin/social-manager', icon: Share2 },
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
    { label: 'Website', href: '/admin/workspace/website', icon: PenTool },
    { label: 'Content Manager', href: '/admin/content-manager', icon: PenTool },
    { label: 'Support Centre', href: '/admin/support', icon: Headphones },
    { label: 'Affiliate Control Centre', href: '/admin/analytics', icon: BarChart3 },
    { label: 'System Testing', href: '/admin/testing', icon: FlaskConical },
    { label: 'Activity & Audit Log', href: '/admin/activity', icon: FileClock },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
    { label: 'Sign Out', href: '/admin/logout', icon: LogOut },
  ] },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null | undefined>(undefined);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState('This month');

  useEffect(() => {
    try {
      setPeriod(window.localStorage.getItem('glonni-admin-period') || 'This month');
      setCollapsed(window.localStorage.getItem('glonni-admin-sidebar-collapsed') === 'true');
    } catch { /* Navigation still works when browser storage is unavailable. */ }
    const media = window.matchMedia('(max-width: 760px)');
    const updateViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    const shell = sidebarRef.current?.closest('.admin-v2');
    shell?.classList.toggle('sidebar-collapsed', collapsed && !isMobile);
    shell?.classList.toggle('mobile-nav-open', mobileOpen && isMobile);
    return () => {
      shell?.classList.remove('sidebar-collapsed', 'mobile-nav-open');
    };
  }, [collapsed, mobileOpen, isMobile]);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarToggleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? []).filter(control => control.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, isMobile]);

  useEffect(() => {
    setMobileOpen(false);
    setExpanded(undefined);
  }, [pathname]);

  const active = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/stores/');
    if (href === '/admin/team') return pathname === href || (pathname.startsWith('/admin/team/') && pathname !== '/admin/team/new');
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkActive = (link: { href: string; children?: readonly { href: string }[] }) => active(link.href) || Boolean(link.children?.some((child) => active(child.href)));
  const sectionOpen = (title: string, links: readonly { href: string; children?: readonly { href: string }[] }[]) => expanded === title || (expanded === undefined && links.some(linkActive));

  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    try { window.localStorage.setItem('glonni-admin-sidebar-collapsed', String(value)); } catch { /* Keep the current state in memory. */ }
  }

  function closeMobileNavigation() {
    setMobileOpen(false);
    mobileToggleRef.current?.focus();
  }

  function toggleSidebar() {
    if (isMobile) closeMobileNavigation();
    else changeCollapsed(!collapsed);
  }

  function toggleSection(title: string, isOpen: boolean) {
    if (collapsed && !isMobile) {
      changeCollapsed(false);
      setExpanded(title);
    } else setExpanded(isOpen ? null : title);
  }

  function choosePeriod(value: string) {
    setPeriod(value);
    setPeriodOpen(false);
    window.localStorage.setItem('glonni-admin-period', value);
  }

  const navLabels: Array<{ href: string; label: string }> = [];
  sections.forEach(section => section.links.forEach(link => navLabels.push({ href: link.href, label: link.label })));
  const currentPageLabel = navLabels.filter(link => active(link.href)).sort((a, b) => b.href.length - a.href.length)[0]?.label ?? 'Glonni Admin';

  return <><aside ref={sidebarRef} id="admin-sidebar" className="admin-side" aria-label="Admin navigation" inert={isMobile && !mobileOpen ? true : undefined}>
    <div className="sidebar-brand-row">
      <a className="admin-brand" href="/admin/dashboard" aria-label="Glonni admin dashboard">
        <span className="admin-brand-logo-wrap" aria-hidden="true"><img src="/brand/glonni-logo-horizontal-navy.svg" alt=""/></span>
      </a>
      <button ref={sidebarToggleRef} type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={isMobile ? 'Close admin sidebar' : collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'} title={isMobile ? 'Close sidebar' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={isMobile ? mobileOpen : !collapsed} aria-controls="admin-sidebar">{collapsed && !isMobile ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button>
    </div>
    <nav>{sections.map((section, index) => { const SectionIcon = section.icon; const isOpen = sectionOpen(section.title, section.links); return <section key={section.title} className={isOpen ? 'open' : ''}><button className="nav-group" type="button" title={section.title} aria-label={section.title} aria-expanded={isOpen && (!collapsed || isMobile)} aria-controls={`admin-nav-group-${index}`} onClick={() => toggleSection(section.title, isOpen)}><span><SectionIcon size={16}/><b>{section.title}</b></span><ChevronDown size={15}/></button><div id={`admin-nav-group-${index}`} className="nav-links">{section.links.map((link) => { const Icon = link.icon; const isActive = active(link.href); const children = ('children' in link ? link.children : undefined) as readonly { href: string; label: string; icon: LucideIcon }[] | undefined; const isParentActive = isActive || Boolean(children?.some((child) => active(child.href))); return <div className={children ? 'nav-item-with-children' : undefined} key={link.href}><a className={isParentActive ? 'selected' : ''} href={link.href} title={link.label} aria-current={isActive ? 'page' : undefined}><span className="nav-icon"><Icon className="nav-symbol" size={17}/></span><span className="nav-label">{link.label}</span></a>{children?.length ? <div className="nav-sub-links">{children.map((child) => { const ChildIcon = child.icon; const childActive = active(child.href); return <a key={child.href} className={childActive ? 'selected' : ''} href={child.href} title={child.label} aria-current={childActive ? 'page' : undefined}><span className="nav-icon"><ChildIcon className="nav-symbol" size={15}/></span><span className="nav-label">{child.label}</span></a>; })}</div> : null}</div>; })}</div></section>; })}</nav>
  </aside><button type="button" className="admin-nav-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={closeMobileNavigation}/><AdminTabRepair/><AdminActionRepair/><CampaignUiRepair/><header className="admin-global-topbar" aria-label="Admin workspace controls">
    <button ref={mobileToggleRef} className="admin-mobile-nav-toggle" type="button" aria-label={mobileOpen ? 'Close admin navigation' : 'Open admin navigation'} aria-expanded={mobileOpen} aria-controls="admin-sidebar" onClick={() => setMobileOpen(value => !value)}>{mobileOpen ? <ChevronLeft size={20}/> : <ChevronRight size={20}/>}</button>
    <h1 className="topbar-page-title">{currentPageLabel}</h1>
    <form action="/admin/search" role="search"><Search size={18}/><input name="q" placeholder="Search users, offers, partners, or activity…" aria-label="Search admin workspace"/></form>
    <div className="topbar-period-wrap"><button className="topbar-period" type="button" aria-label="Dashboard reporting period" aria-expanded={periodOpen} onClick={() => setPeriodOpen(value => !value)}><Clock3 size={17}/>{period}<ChevronDown size={14}/></button>{periodOpen&&<div className="topbar-period-menu" role="menu"><button type="button" onClick={() => choosePeriod('Today')}>Today</button><button type="button" onClick={() => choosePeriod('Last 7 days')}>Last 7 days</button><button type="button" onClick={() => choosePeriod('This month')}>This month</button><button type="button" onClick={() => choosePeriod('This quarter')}>This quarter</button></div>}</div>
    <span className="topbar-mode">MOCK MODE · TEST DATA</span>
    <a className="topbar-bell" href="/admin/notifications" aria-label="Open notifications"><Bell size={23}/><i/></a>
    <span className="topbar-avatar">SR</span>
    <span className="topbar-owner"><b>Shaneel</b><small>Owner</small></span>
  </header></>;
}
