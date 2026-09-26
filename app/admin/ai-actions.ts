'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const enc = (value: string) => encodeURIComponent(value);
async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const role = user?.app_metadata?.admin_role;
  if (!user || assurance?.currentLevel !== 'aal2' || role !== 'owner') redirect('/admin/login');
  return { supabase, user };
}

export async function decideAiWork(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const id = String(formData.get('workItemId') ?? '');
  const decision = String(formData.get('decision') ?? 'on_hold');
  const note = String(formData.get('note') ?? '').trim();
  const requestedRedirect = String(formData.get('redirectTo') ?? '/admin/approvals');
  const redirectTo = requestedRedirect.startsWith('/admin/ai-agents') || requestedRedirect === '/admin/approvals' ? requestedRedirect : '/admin/approvals';
  if (!['approved', 'rejected', 'on_hold'].includes(decision)) redirect('/admin/approvals?error=Invalid+decision');
  const { data: existingWork } = await supabase.from('ai_work_items').select('context').eq('id', id).maybeSingle();
  const { error } = await supabase.from('ai_work_items').update({ status: decision, decision_note: note || null, decided_at: new Date().toISOString(), decided_by: user.id, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${enc(error.message)}`);
  await supabase.from('ai_work_events').insert({ work_item_id: id, event_type: `owner_${decision}`, actor_id: user.id, detail: { note } });
  const context = (existingWork?.context ?? {}) as Record<string, string>;
  const campaignId = context.content_campaign_id;
  const assetId = context.content_asset_id;
  if (campaignId && assetId) {
    const { error: assetError } = await supabase.from('content_campaign_assets').update({ status: decision, updated_at: new Date().toISOString() }).eq('id', assetId).eq('ai_work_item_id', id);
    if (assetError) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${enc(assetError.message)}`);
    const { data: assets } = await supabase.from('content_campaign_assets').select('status').eq('campaign_id', campaignId);
    const statuses = (assets ?? []).map((asset) => asset.status as string);
    const terminal = statuses.length > 0 && statuses.every((status) => ['approved', 'rejected', 'on_hold'].includes(status));
    const campaignStatus = terminal
      ? statuses.includes('rejected') ? 'rejected' : statuses.every((status) => status === 'approved') ? 'approved' : 'on_hold'
      : 'pending_review';
    const { error: campaignError } = await supabase.from('content_campaigns').update({ status: campaignStatus, decided_by: terminal ? user.id : null, decision_note: terminal ? note || null : null, decided_at: terminal ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', campaignId);
    if (campaignError) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${enc(campaignError.message)}`);
    await supabase.from('content_campaign_events').insert({ campaign_id: campaignId, asset_id: assetId, actor_id: user.id, event_type: `ceo_${decision}`, detail: { ai_work_item_id: id, note } });
    revalidatePath('/admin/content-manager');
  }
  revalidatePath('/admin/ai-agents'); revalidatePath('/admin/approvals'); revalidatePath('/admin/ads'); revalidatePath('/admin/social-accounts');
  redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}success=Decision+recorded+and+audited.`);
}

export async function addOwnerInstruction(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const instruction = String(formData.get('instruction') ?? '').trim();
  const scope = String(formData.get('scope') ?? 'all_agents');
  const requestedRedirect = String(formData.get('redirectTo') ?? '/admin/ai-agents');
  const redirectTo = requestedRedirect.startsWith('/admin/ai-agents') ? requestedRedirect : '/admin/ai-agents';
  if (instruction.length < 3) redirect('/admin/ai-agents?error=Enter+a+clear+instruction.');
  const { error } = await supabase.from('ai_owner_instructions').insert({ instruction, scope, issued_by: user.id });
  if (error) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${enc(error.message)}`);
  revalidatePath('/admin/ai-agents'); revalidatePath('/admin/ai-agents/ceo-operations');
  redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}success=Instruction+saved+for+future+AI+workflows.`);
}

export async function toggleAiAgent(formData: FormData) {
  const { supabase } = await requireOwner();
  const agentKey = String(formData.get('agentKey') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  const requestedRedirect = String(formData.get('redirectTo') ?? '/admin/ai-agents/ceo-operations');
  const redirectTo = requestedRedirect.startsWith('/admin/ai-agents') ? requestedRedirect : '/admin/ai-agents/ceo-operations';
  if (!agentKey) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=Missing+agent.`);
  const { error } = await supabase.from('ai_agents').update({
    is_enabled: enabled,
    runtime_status: enabled ? 'idle' : 'disabled',
    operating_mode: enabled ? 'approval_required' : 'not_connected',
    updated_at: new Date().toISOString(),
  }).eq('key', agentKey);
  if (error) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${enc(error.message)}`);
  revalidatePath('/admin/ai-agents/ceo-operations'); revalidatePath('/admin/ai-agents');
  redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}success=Agent+${enabled ? 'started' : 'stopped'}.`);
}
