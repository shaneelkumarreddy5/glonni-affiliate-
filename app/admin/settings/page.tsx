import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { SettingsWorkspace, type GlobalSettings, type SettingsHealth } from './settings-workspace';
import './settings.css';

export const dynamic = 'force-dynamic';

const defaults: GlobalSettings = {
  site_name: 'Glonni', logo_url: '', default_language: 'en-IN',
  global_rules: '', work_controls: { product_intake: true, scheduled_promotions: true, nonessential_notifications: true, ai_workflows: true, pause_all: false },
  require_admin_approval: true,
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const [identityResult, settingsResult, agentsResult, jobsResult, feedsResult, campaignsResult, templatesResult] = await Promise.all([
    supabase.from('website_identity').select('site_name,logo_url,default_language').eq('id', 1).maybeSingle(),
    supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('ai_agents').select('key,is_enabled,runtime_status,capability_status'),
    supabase.from('ai_jobs').select('id,status,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('product_feeds').select('id,status'),
    supabase.from('homepage_campaigns').select('id,status,starts_at,ends_at'),
    supabase.from('notification_templates').select('id,status,category,is_promotional'),
  ]);
  const identity = identityResult.data as Pick<GlobalSettings, 'site_name' | 'logo_url' | 'default_language'> | null;
  const operational = settingsResult.data as Partial<GlobalSettings> | null;
  const settings: GlobalSettings = {
    ...defaults,
    ...(identity ?? {}),
    ...(operational ?? {}),
    work_controls: { ...defaults.work_controls, ...(operational?.work_controls ?? {}) },
  };
  const agents = agentsResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const feeds = feedsResult.data ?? [];
  const campaigns = campaignsResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const health: SettingsHealth = {
    ai_available: !agentsResult.error && !jobsResult.error,
    ai_enabled: agents.filter((agent) => agent.is_enabled).length,
    ai_total: agents.length,
    ai_failed_recent: jobs.filter((job) => job.status === 'failed').length,
    feeds_available: !feedsResult.error,
    feeds_active: feeds.filter((feed) => feed.status === 'active').length,
    feeds_total: feeds.length,
    campaigns_available: !campaignsResult.error,
    campaigns_live: campaigns.filter((campaign) => campaign.status === 'published').length,
    campaigns_total: campaigns.length,
    templates_available: !templatesResult.error,
    templates_active: templates.filter((template) => template.status === 'active').length,
    templates_total: templates.length,
  };
  const connected = Boolean(settingsResult.data && identityResult.data) && !settingsResult.error && !identityResult.error;

  return <main className="admin-v2 settings-admin"><AdminSidebar/><section className="admin-main"><header className="admin-top"><b>Global Settings</b><span className="dashboard-date">Website-wide controls</span></header><main className="admin-content settings-content"><SettingsWorkspace initial={settings} health={health} connected={connected}/></main></section></main>;
}
