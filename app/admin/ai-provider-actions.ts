'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const workflows = ['decision', 'generative', 'research', 'support', 'execution'] as const;
const providers = ['openai', 'gemini', 'deepseek', 'jiao'] as const;

export async function saveAiProviderAssignments(formData: FormData) {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  const role = user?.app_metadata?.admin_role;
  if (!user || assurance?.currentLevel !== 'aal2' || !['owner', 'admin'].includes(String(role))) redirect('/admin/login');
  const rows = workflows.map((workflow_key) => ({ workflow_key, provider_key: String(formData.get(workflow_key) ?? '') }));
  if (rows.some((row) => !providers.includes(row.provider_key as typeof providers[number]))) redirect('/admin/ai-agents?error=Choose+one+provider+for+every+workflow.');
  const selected = [...new Set(rows.map((row) => row.provider_key))];
  const { data: connections, error: connectionError } = await supabase.from('ai_provider_connections').select('provider_key,connection_status').in('provider_key', selected);
  if (connectionError) redirect(`/admin/ai-agents?error=${encodeURIComponent(connectionError.message)}`);
  const unavailable = (connections ?? []).filter((row) => row.connection_status !== 'connected').map((row) => row.provider_key);
  if (unavailable.length) redirect(`/admin/ai-agents?error=${encodeURIComponent(`Connect ${unavailable.join(', ')} before assigning it to a workflow.`)}`);
  for (const row of rows) {
    const { error } = await supabase.from('ai_provider_assignments').update({ provider_key: row.provider_key, updated_by: user.id, updated_at: new Date().toISOString() }).eq('workflow_key', row.workflow_key);
    if (error) redirect(`/admin/ai-agents?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/admin/ai-agents');
  redirect('/admin/ai-agents?success=AI+provider+assignments+saved.');
}
