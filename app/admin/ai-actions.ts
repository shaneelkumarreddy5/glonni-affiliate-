'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { campaignStatusAfterCeoReviews, campaignStatusAfterFinalApprovals, managerPathForContentChannel } from '@/lib/content-routing';

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
    // A rejected channel asset must not block an approved sibling destination.
    const campaignStatus = campaignStatusAfterCeoReviews(statuses);
    const terminal = campaignStatus !== 'pending_review';
    const { error: campaignError } = await supabase.from('content_campaigns').update({ status: campaignStatus, decided_by: terminal ? user.id : null, decision_note: terminal ? note || null : null, decided_at: terminal ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', campaignId);
    if (campaignError) redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${enc(campaignError.message)}`);
    await supabase.from('content_campaign_events').insert({ campaign_id: campaignId, asset_id: assetId, actor_id: user.id, event_type: `ceo_${decision}`, detail: { ai_work_item_id: id, note } });
    revalidatePath('/admin/content-manager');
  }
  revalidatePath('/admin/ai-agents'); revalidatePath('/admin/approvals'); revalidatePath('/admin/ads'); revalidatePath('/admin/social-manager'); revalidatePath('/admin/social-accounts');
  redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}success=Decision+recorded+and+audited.`);
}

export async function finalizeContentAsset(formData: FormData) {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active') {
    redirect('/admin/login?error=Active+admin+access+is+required.');
  }

  const workItemId = String(formData.get('workItemId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  const requestedRedirect = String(formData.get('redirectTo') ?? '/admin/ai-agents/ceo-operations?agent=content_experience&tab=approvals');
  const redirectTo = requestedRedirect.startsWith('/admin/ai-agents/ceo-operations')
    ? requestedRedirect
    : '/admin/ai-agents/ceo-operations?agent=content_experience&tab=approvals';
  if (!['admin_approved', 'rejected'].includes(decision)) {
    redirect(`${redirectTo}&error=Choose+approve+or+reject.`);
  }

  const { data: workItem } = await supabase.from('ai_work_items').select('id,status,context').eq('id', workItemId).maybeSingle();
  const context = (workItem?.context ?? {}) as Record<string, string>;
  const campaignId = context.content_campaign_id;
  const assetId = context.content_asset_id;
  if (workItem?.status !== 'approved' || !campaignId || !assetId) {
    redirect(`${redirectTo}&error=This+creative+has+not+passed+CEO+review.`);
  }
  const [{ data: campaign }, { data: asset }] = await Promise.all([
    supabase.from('content_campaigns').select('id,status').eq('id', campaignId).maybeSingle(),
    supabase.from('content_campaign_assets').select('id,status,channel_type,ai_work_item_id').eq('id', assetId).eq('ai_work_item_id', workItemId).maybeSingle(),
  ]);
  if (campaign?.status !== 'approved' || asset?.status !== 'approved') {
    redirect(`${redirectTo}&error=This+creative+is+not+ready+for+final+admin+approval.`);
  }

  const { error: assetError } = await supabase.from('content_campaign_assets')
    .update({ status: decision, updated_at: new Date().toISOString() })
    .eq('id', assetId).eq('ai_work_item_id', workItemId).eq('status', 'approved');
  if (assetError) redirect(`${redirectTo}&error=${enc(assetError.message)}`);

  const { data: assets, error: assetsError } = await supabase.from('content_campaign_assets')
    .select('status,channel_type').eq('campaign_id', campaignId);
  if (assetsError || !assets?.length) redirect(`${redirectTo}&error=${enc(assetsError?.message ?? 'Campaign assets could not be verified.')}`);
  const campaignStatus = campaignStatusAfterFinalApprovals(assets.map((row) => row.status as string));
  if (campaignStatus !== 'approved') {
    const { error: campaignError } = await supabase.from('content_campaigns').update({
      status: campaignStatus,
      decided_by: user.id,
      decision_note: note || null,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId).eq('status', 'approved');
    if (campaignError) redirect(`${redirectTo}&error=${enc(campaignError.message)}`);
  }

  const channel = asset.channel_type === 'social' ? 'social' : 'paid_ads';
  await supabase.from('content_campaign_events').insert({
    campaign_id: campaignId,
    asset_id: assetId,
    actor_id: user.id,
    event_type: decision === 'admin_approved' ? 'final_admin_approved' : 'final_admin_rejected',
    detail: {
      note,
      channel,
      handoff_path: decision === 'admin_approved' ? managerPathForContentChannel(channel) : null,
      handoff_state: decision === 'admin_approved' ? 'routed_to_manager_queue' : 'not_routed',
    },
  });
  revalidatePath('/admin/content-manager');
  revalidatePath('/admin/ai-agents/ceo-operations');
  revalidatePath('/admin/ads');
  revalidatePath('/admin/social-manager');
  redirect(`${redirectTo}&success=${decision === 'admin_approved' ? 'Final+approval+saved+and+sent+to+the+channel+manager+queue.' : 'Content+rejected+and+recorded.'}`);
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
