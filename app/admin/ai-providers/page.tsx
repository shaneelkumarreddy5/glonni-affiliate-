import { AdminSidebar } from '@/components/admin-sidebar';
import { AiProviderRouting } from '@/components/ai-provider-routing';
import { createClient } from '@/lib/supabase/server';
import { Bot, Bell, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AiProvidersPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-provider-health`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      cache: 'no-store',
    }).catch(() => null);
  }
  const [{ data: assignments }, { data: connections }] = await Promise.all([
    supabase.from('ai_provider_assignments').select('workflow_key,provider_key'),
    supabase.from('ai_provider_connections').select('provider_key,display_name,connection_status'),
  ]);
  const query = await searchParams;
  return <main className="admin-v2 ai-admin"><AdminSidebar/><section className="admin-main"><header className="admin-top"><Bot size={21}/><b>AI Company</b><span className="dashboard-date">Provider routing and secure assignments</span><Bell size={19}/><span className="avatar">SR</span></header><main className="ai-command"><div className="ai-command-head"><div><p>GLONNI AI COMPANY</p><h1>AI Providers</h1><span>Choose which approved AI service runs each Glonni workflow.</span></div><a className="add-store" href="/admin/ai-agents">Back to AI Agents</a></div>{query.error && <p className="preview-note">{query.error}</p>}{query.success && <p className="preview-note"><ShieldCheck/> {query.success}</p>}<AiProviderRouting assignments={assignments ?? []} connections={connections ?? []}/></main></section></main>;
}
