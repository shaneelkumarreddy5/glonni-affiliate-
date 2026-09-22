import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, ChevronRight, CircleDollarSign, Gift, Megaphone, PackageCheck, ShieldCheck, ShoppingBag, Tag, TicketCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { markAllNotificationsRead, markNotificationRead } from './actions';
import './notifications.css';

type Props = { searchParams: Promise<{ category?: string; success?: string; error?: string }> };
type Notice = { id: string; category: string; title: string; body: string; destination: string | null; created_at: string; read_at: string | null };
const categories = [
  ['cashback','Cashback',CircleDollarSign],['shopping_orders','Shopping and orders',ShoppingBag],['deals_offers','Deals and offers',Tag],['price_product_alerts','Price and product alerts',PackageCheck],
  ['account_security','Account and security',ShieldCheck],['support','Support',TicketCheck],['rewards_referrals','Rewards and referrals',Gift],['system_announcements','System announcements',Megaphone],
] as const;
const categoryName = (key: string) => categories.find(([value]) => value === key)?.[1] || 'Glonni update';
const timestamp = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/notifications')}`);
  const { data } = await supabase.from('customer_notifications').select('id,category,title,body,destination,created_at,read_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(200);
  const all = (data ?? []) as Notice[];
  const selected = categories.some(([key]) => key === params.category) ? params.category : '';
  const rows = all.filter((notice) => !selected || notice.category === selected);
  const unread = all.filter((notice) => !notice.read_at).length;
  const counts = Object.fromEntries(categories.map(([key]) => [key, all.filter((notice) => notice.category === key).length]));

  return <><Header/><main className="customer-notifications"><div className="customer-notifications-title"><div><p>YOUR GLONNI ACCOUNT</p><h1>Notifications</h1><span>Cashback, shopping, account, and support updates tied to your activity.</span></div><div className="customer-notification-actions"><span>{unread} unread</span>{unread > 0 && <form action={markAllNotificationsRead}><button type="submit">Mark all as read</button></form>}</div></div>
    {params.success && <p className="customer-notification-message">{params.success}</p>}{params.error && <p className="customer-notification-message error">{params.error}</p>}
    <div className="customer-notification-filters"><Link href="/notifications" className={!selected ? 'active' : ''}>All <em>{all.length}</em></Link>{categories.map(([key,label]) => <Link key={key} href={`/notifications?category=${key}`} className={selected===key?'active':''}>{label}<em>{counts[key]}</em></Link>)}</div>
    <section className="customer-notification-list">{rows.length ? rows.map((notice) => { const Icon = categories.find(([key]) => key === notice.category)?.[2] || Bell; const destination = notice.destination && notice.destination.startsWith('/') && !notice.destination.startsWith('//') ? notice.destination : null; return <details className={`customer-notice ${notice.read_at?'read':'unread'}`} key={notice.id}><summary><span className="notice-unread-mark" aria-label={notice.read_at?'Read':'Unread'}/><span className={`notice-icon ${notice.category}`}><Icon size={19}/></span><span className="notice-copy"><b>{notice.title}</b><small>{notice.body}</small></span><span className="notice-meta"><em>{categoryName(notice.category)}</em><time>{timestamp(notice.created_at)}</time></span><ChevronRight size={17} className="notice-chevron"/></summary><div className="customer-notice-expanded"><p>{notice.body}</p><div>{destination ? <Link href={destination}>View related information <ChevronRight size={15}/></Link> : <span>Sent to your Glonni account</span>}{!notice.read_at && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notice.id}/><button type="submit">Mark as read</button></form>}</div></div></details>}) : <div className="customer-notification-empty"><Bell size={26}/><h2>{selected ? `No ${categoryName(selected).toLowerCase()} yet` : 'You’re all caught up'}</h2><p>When a connected Glonni activity needs your attention, it will appear here.</p></div>}</section>
    <aside className="customer-notification-note"><ShieldCheck size={18}/><p>Important cashback, security, support, and service updates are delivered in your account. Promotional campaigns follow your notification preferences.</p></aside>
  </main></>;
}
