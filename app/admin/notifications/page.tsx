import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, CheckCircle2, ChevronDown, CircleAlert, FileText, Mail, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminNotificationCampaignForm } from '@/components/admin-notification-campaign-form';
import { createClient } from '@/lib/supabase/server';
import { saveNotificationTemplate } from './actions';
import './notifications.css';

type Props = { searchParams: Promise<{ tab?: string; category?: string; delivery?: string; success?: string; error?: string }> };
type Template = { id: string; category: string; template_key: string; name: string; trigger_description: string; subject: string; body: string; in_app_enabled: boolean; email_enabled: boolean; push_enabled: boolean; is_promotional: boolean; status: 'active' | 'draft' | 'paused'; updated_at: string };
type NotificationRow = { id: string; profile_id: string; category: string; title: string; body: string; source_table: string; source_id: string; event_key: string; destination: string | null; created_at: string; read_at: string | null; profiles: { display_name: string | null } | null };

const categories = [
  ['cashback', 'Cashback'], ['shopping_orders', 'Shopping and orders'], ['deals_offers', 'Deals and offers'], ['price_product_alerts', 'Price and product alerts'],
  ['account_security', 'Account and security'], ['support', 'Support'], ['rewards_referrals', 'Rewards and referrals'], ['system_announcements', 'System announcements'],
] as const;
const categoryName = (key: string) => categories.find(([value]) => value === key)?.[1] || key;
const timestamp = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const validCategory = categories.some(([key]) => key === params.category) ? params.category : '';
  const tab = params.tab === 'delivery' ? 'delivery' : validCategory ? 'category' : 'templates';
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user) redirect('/admin/login?next=/admin/notifications');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin', 'editor'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') redirect('/admin/login?next=/admin/notifications&error=Complete+admin+verification+to+manage+notifications');

  const [templateResult, deliveryResult, totalResult, unreadResult] = await Promise.all([
    supabase.from('notification_templates').select('id,category,template_key,name,trigger_description,subject,body,in_app_enabled,email_enabled,push_enabled,is_promotional,status,updated_at').order('category').order('name'),
    supabase.from('customer_notifications').select('id,profile_id,category,title,body,source_table,source_id,event_key,destination,created_at,read_at,profiles(display_name)').order('created_at', { ascending: false }).limit(120),
    supabase.from('customer_notifications').select('id', { count: 'exact', head: true }),
    supabase.from('customer_notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  const templates = (templateResult.data ?? []) as Template[];
  const allDeliveries = (deliveryResult.data ?? []) as unknown as NotificationRow[];
  const deliveries = allDeliveries.filter((row) => params.delivery === 'unread' ? !row.read_at : params.delivery === 'read' ? Boolean(row.read_at) : true);
  const categoryTemplates = templates.filter((item) => !validCategory || item.category === validCategory);
  const activeTemplates = templates.filter((item) => item.status === 'active').length;
  const failed = Number(Boolean(templateResult.error || deliveryResult.error || totalResult.error || unreadResult.error));
  const total = totalResult.count ?? 0;
  const unread = unreadResult.count ?? 0;
  const templateCountByCategory = Object.fromEntries(categories.map(([key]) => [key, templates.filter((item) => item.category === key).length]));

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><header className="admin-top"><Bell size={21}/><b>Notifications</b><span className="dashboard-date">Customer notification workspace</span><Bell size={19}/><span className="avatar">SR</span></header><main className="admin-content admin-notifications-page">
    <div className="admin-title"><div><p>NOTIFICATION MANAGEMENT</p><h1>Notifications</h1><span>Create and monitor customer updates. Automated events use the customer ID linked to their source record.</span></div></div>
    {params.success && <p className="notification-flash success"><CheckCircle2 size={17}/>{params.success}</p>}{params.error && <p className="notification-flash error"><CircleAlert size={17}/>{params.error}</p>}
    <p className="preview-note">In-app delivery is live. Cashback, purchases, support, referrals, store clicks and saved price alerts route through their verified customer profile ID. Email and push remain unavailable until delivery providers are connected.</p>
    <section className="admin-stats notification-stats"><article><FileText/><div><small>Active templates</small><b>{activeTemplates}</b><em>{templates.length} configured</em></div></article><article><Bell/><div><small>In-app notifications</small><b>{total}</b><em>Saved to customer accounts</em></div></article><article><MessageSquare/><div><small>Unread</small><b>{unread}</b><em>Across customer accounts</em></div></article><article><CircleAlert/><div><small>Delivery provider</small><b>{failed ? 'Check access' : 'In-app live'}</b><em>Email and push not connected</em></div></article></section>
    <AdminNotificationCampaignForm templates={templates.filter((template) => template.status === 'active').map(({ id, template_key, name, category, subject, body }) => ({ id, template_key, name, category, subject, body }))}/>
    <div className="notification-tabs" role="tablist" aria-label="Notification management views"><Link href="/admin/notifications?tab=templates" className={tab === 'templates' ? 'active' : ''}><FileText size={16}/>Templates <em>{templates.length}</em></Link><Link href="/admin/notifications?tab=delivery" className={tab === 'delivery' ? 'active' : ''}><Bell size={16}/>Delivery log <em>{total}</em></Link></div>
    {tab !== 'delivery' ? <>
      <div className="notification-category-tabs" aria-label="Notification categories"><Link href="/admin/notifications?tab=templates" className={!validCategory ? 'active' : ''}>All templates <em>{templates.length}</em></Link>{categories.map(([key, label]) => <Link key={key} href={`/admin/notifications?category=${key}`} className={validCategory === key ? 'active' : ''}>{label}<em>{templateCountByCategory[key]}</em></Link>)}</div>
      <section className="notification-template-panel"><div className="notification-panel-heading"><div><p>{validCategory ? categoryName(validCategory).toUpperCase() : 'SHARED TEMPLATE LIBRARY'}</p><h2>{validCategory ? `${categoryName(validCategory)} notifications` : 'Notification templates'}</h2><span>Each template is connected to a source event where available. Expand a row to edit its copy and activation status.</span></div><span className="notification-count">{categoryTemplates.length} templates</span></div>
        <div className="notification-template-list">{categoryTemplates.map((template) => <details className="notification-template" key={template.id}><summary><span className="template-icon"><Bell size={17}/></span><span className="template-summary"><b>{template.name}</b><small>{template.trigger_description}</small></span><span className="template-channels"><i><Bell size={13}/>In-app {template.in_app_enabled ? 'on' : 'off'}</i><i className="unavailable"><Mail size={13}/>Email unavailable</i><i className="unavailable"><Smartphone size={13}/>Push unavailable</i></span><em className={`notification-status ${template.status}`}>{template.status}</em><ChevronDown size={16} className="template-chevron"/></summary><form action={saveNotificationTemplate} className="notification-template-editor"><input type="hidden" name="templateId" value={template.id}/><div className="template-source-note"><CheckCircle2 size={16}/><span><b>Source connection</b><small>{template.trigger_description || 'Admin-created in-app campaign; recipient audience is validated before sending.'} · Key: {template.template_key}</small></span></div><div className="template-fields"><label>Template name<input name="name" defaultValue={template.name} maxLength={120} required/></label><label>Status<select name="status" defaultValue={template.status}><option value="active">Active for new events</option><option value="paused">Paused</option><option value="draft">Draft</option></select></label><label className="template-wide">Notification title<input name="subject" defaultValue={template.subject} maxLength={180} required/></label><label className="template-wide">Message<textarea name="body" defaultValue={template.body} maxLength={2000} required rows={4}/><small>Personalization placeholders are filled from the source record when one exists.</small></label></div><div className="template-editor-footer"><span><Bell size={14}/> In-app active <Mail size={14}/> Email not connected <Smartphone size={14}/> Push not connected</span><button type="submit">Save template</button></div></form></details>)}{categoryTemplates.length === 0 && <div className="notification-empty"><Bell/><h3>No templates in this category yet</h3><p>Configured templates will appear here as their source workflows are added.</p></div>}</div>
      </section>
      <section className="notification-delivery-panel"><div className="notification-panel-heading"><div><p>RECENT CUSTOMER DELIVERY</p><h2>Latest in-app notifications</h2><span>Recipient identity is taken from the linked customer account.</span></div><Link href="/admin/notifications?tab=delivery">View delivery log →</Link></div><DeliveryRows rows={allDeliveries.slice(0, 6)}/></section>
    </> : <section className="notification-delivery-panel full"><div className="notification-panel-heading"><div><p>DELIVERY HISTORY</p><h2>Customer notification log</h2><span>Showing the latest 120 records. Recipient details are minimized here; source links open the relevant page.</span></div></div><div className="delivery-filters"><Link href="/admin/notifications?tab=delivery">All ({total})</Link><Link href="/admin/notifications?tab=delivery&delivery=unread">Unread ({unread})</Link><Link href="/admin/notifications?tab=delivery&delivery=read">Read ({total - unread})</Link></div><DeliveryRows rows={deliveries}/></section>}
  </main></section></main>;
}

function DeliveryRows({ rows }: { rows: NotificationRow[] }) {
  if (!rows.length) return <div className="notification-empty"><Bell/><h3>No notifications sent yet</h3><p>New in-app updates will appear here after a connected source event or approved campaign.</p></div>;
  return <div className="delivery-list">{rows.map((row) => <article key={row.id}><span className="delivery-category-icon"><Bell size={16}/></span><span className="delivery-copy"><b>{row.title}</b><small>{categoryName(row.category)} · <Link href={`/admin/users/${row.profile_id}`}>{row.profiles?.display_name || `Customer ${row.profile_id.slice(0, 7)}`}</Link> · {timestamp(row.created_at)}</small><em>{row.body}</em></span><span className={row.read_at ? 'delivery-status read' : 'delivery-status'}>{row.read_at ? 'Read' : 'In app'}</span><span className="delivery-source">{row.destination?.startsWith('/') && !row.destination.startsWith('//') ? <Link href={row.destination}>Open source</Link> : <small>{row.source_table.replaceAll('_', ' ')}</small>}</span></article>)}</div>;
}
