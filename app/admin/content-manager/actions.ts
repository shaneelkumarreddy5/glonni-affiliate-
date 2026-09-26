'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const validPlatforms = ['instagram', 'facebook', 'google_ads', 'meta_ads'] as const;
const platformType = (platform: string) => platform === 'instagram' || platform === 'facebook' ? 'social' : 'paid_ads';
const clean = (value: FormDataEntryValue | null, max = 5000) => String(value ?? '').trim().slice(0, max);
const back = (tab: string, status: 'success' | 'error', message: string) => `/admin/content-manager?tab=${tab}&${status}=${encodeURIComponent(message)}`;

async function contentOperator() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  const allowed = ['owner', 'admin', 'editor'];
  if (!profile || !allowed.includes(profile.role) || employee?.status !== 'active') throw new Error('An active staff account with two-factor authentication is required.');
  return { supabase, user };
}

async function recordEvent(supabase: Awaited<ReturnType<typeof createClient>>, campaignId: string, actorId: string, eventType: string, assetId: string | null = null, detail: Record<string, unknown> = {}) {
  const { error } = await supabase.from('content_campaign_events').insert({ campaign_id: campaignId, asset_id: assetId, actor_id: actorId, event_type: eventType, detail });
  if (error) throw new Error(error.message);
}

function refreshContent() {
  revalidatePath('/admin/content-manager');
  revalidatePath('/admin/ai-agents');
  revalidatePath('/admin/ai-agents/ceo-operations');
  revalidatePath('/admin/ads');
  revalidatePath('/admin/social-manager');
}

export async function saveContentDraft(form: FormData) {
  const { supabase, user } = await contentOperator();
  const title = clean(form.get('title'), 180);
  const offerId = clean(form.get('offerId'), 80);
  const editingCampaignId = clean(form.get('campaignId'), 80);
  const platforms = [...new Set(form.getAll('platforms').map(String).filter((value) => (validPlatforms as readonly string[]).includes(value)))];
  const format = clean(form.get('format'), 30);
  const headline = clean(form.get('headline'), 180);
  const caption = clean(form.get('caption'), 4000);
  const description = clean(form.get('description'), 4000);
  const cta = clean(form.get('cta'), 80);
  const brief = clean(form.get('brief'), 2000);
  const file = form.get('creative');
  if (title.length < 3 || !offerId || !platforms.length || !['square', 'portrait', 'story', 'landscape'].includes(format)) redirect(back('create', 'error', 'Choose a deal, at least one destination, and a creative format.'));
  if (!headline && !caption && !description) redirect(back('create', 'error', 'Add a headline or customer-facing copy before saving.'));
  if (file instanceof File && file.size > 10 * 1024 * 1024) redirect(back('create', 'error', 'Creative image must be 10 MB or smaller.'));
  if (file instanceof File && file.size && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) redirect(back('create', 'error', 'Upload a JPG, PNG, or WebP creative image.'));

  const { data: offer, error: offerError } = await supabase.from('offers')
    .select('id,current_price,list_price,cashback_amount,cashback_percent,reward_terms,stock_status,ends_at,destination_url,status,updated_at,products(title,brand,image_url),merchants(name)')
    .eq('id', offerId).eq('status', 'active').maybeSingle();
  if (offerError || !offer || !Number(offer.current_price) || !String(offer.destination_url ?? '').startsWith('http')) redirect(back('create', 'error', 'That deal is no longer an active, linkable offer. Choose another deal.'));
  const product = Array.isArray(offer.products) ? offer.products[0] : offer.products;
  const merchant = Array.isArray(offer.merchants) ? offer.merchants[0] : offer.merchants;
  const discount = Number(offer.list_price) > Number(offer.current_price) ? Math.min(22, Math.round((Number(offer.list_price) - Number(offer.current_price)) / Number(offer.list_price) * 100)) : 0;
  const freshHours = offer.updated_at ? (Date.now() - new Date(offer.updated_at).getTime()) / 36e5 : 9999;
  const recommendationScore = Math.min(96, 52 + discount + (offer.cashback_amount || offer.cashback_percent ? 8 : 0) + (offer.stock_status === 'in_stock' ? 7 : 0) + (freshHours < 72 ? 7 : 0));
  const recommendationReason = [
    'Rule-ranked active affiliate offer',
    discount ? `${discount}% listed price difference` : '',
    offer.cashback_amount || offer.cashback_percent ? 'customer cashback configured' : '',
    offer.stock_status === 'in_stock' ? 'reported in stock' : '',
    freshHours < 72 ? 'recently updated' : '',
  ].filter(Boolean).join('; ');
  const offerSnapshot = {
    offer_id: offer.id,
    product: product?.title ?? 'Product',
    brand: product?.brand ?? null,
    store: merchant?.name ?? 'Store',
    current_price: offer.current_price,
    list_price: offer.list_price,
    customer_cashback_amount: offer.cashback_amount,
    customer_cashback_percent: offer.cashback_percent,
    reward_terms: offer.reward_terms,
    stock_status: offer.stock_status,
    destination_url: offer.destination_url,
    source_updated_at: offer.updated_at,
  };

  let campaignId = editingCampaignId;
  let existingAssets: any[] = [];
  if (editingCampaignId) {
    const [{ data: existingCampaign }, { data: assets }] = await Promise.all([
      supabase.from('content_campaigns').select('id,status').eq('id', editingCampaignId).maybeSingle(),
      supabase.from('content_campaign_assets').select('*').eq('campaign_id', editingCampaignId),
    ]);
    if (!existingCampaign || !['draft', 'on_hold', 'changes_requested'].includes(existingCampaign.status)) redirect(back('create', 'error', 'Only a draft returned for edits can be changed.'));
    existingAssets = assets ?? [];
  } else {
    const { data: campaign, error: campaignError } = await supabase.from('content_campaigns').insert({
      title, source_offer_id: offer.id, offer_snapshot: offerSnapshot, recommendation_score: recommendationScore, recommendation_reason: recommendationReason, admin_brief: brief, status: 'draft', created_by: user.id,
    }).select('id').single();
    if (campaignError || !campaign) redirect(back('create', 'error', campaignError?.message ?? 'Unable to save this content draft.'));
    campaignId = campaign.id;
  }

  let mediaPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'creative';
    mediaPath = `${user.id}/${campaignId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('content-creatives').upload(mediaPath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) {
      if (!editingCampaignId) await supabase.from('content_campaigns').delete().eq('id', campaignId);
      redirect(back('create', 'error', `Creative upload failed: ${uploadError.message}`));
    }
  }

  const rows = platforms.map((platform) => {
    const oldAsset = existingAssets.find((asset) => asset.platform_key === platform);
    return {
    campaign_id: campaignId,
    channel_type: platformType(platform),
    platform_key: platform,
    creative_format: format,
    headline,
    caption,
    description,
    cta_label: cta,
    media_path: mediaPath ?? oldAsset?.media_path ?? null,
    destination_url: offer.destination_url,
    status: 'draft',
    version: (oldAsset?.version ?? 0) + 1,
    ai_work_item_id: null,
  };
  });
  const { error: campaignError } = await supabase.from('content_campaigns').update({ title, source_offer_id: offer.id, offer_snapshot: offerSnapshot, recommendation_score: recommendationScore, recommendation_reason: recommendationReason, admin_brief: brief, status: 'draft', submitted_at: null, decided_by: null, decision_note: null, decided_at: null, updated_at: new Date().toISOString() }).eq('id', campaignId);
  if (campaignError) redirect(back('create', 'error', campaignError.message));
  const { error: assetError } = await supabase.from('content_campaign_assets').upsert(rows, { onConflict: 'campaign_id,platform_key' });
  if (assetError) {
    if (mediaPath) await supabase.storage.from('content-creatives').remove([mediaPath]);
    if (!editingCampaignId) await supabase.from('content_campaigns').delete().eq('id', campaignId);
    redirect(back('create', 'error', `Draft assets could not be saved: ${assetError.message}`));
  }
  const removedPlatforms = existingAssets.map((asset) => asset.platform_key).filter((platform) => !platforms.includes(platform));
  if (removedPlatforms.length) {
    const { error: removeError } = await supabase.from('content_campaign_assets').delete().eq('campaign_id', campaignId).in('platform_key', removedPlatforms);
    if (removeError) throw new Error(removeError.message);
  }
  if (editingCampaignId && mediaPath) {
    const oldPaths = [...new Set(existingAssets.map((asset) => asset.media_path).filter(Boolean))] as string[];
    const { data: currentAssets } = await supabase.from('content_campaign_assets').select('media_path').eq('campaign_id', campaignId);
    const retained = new Set((currentAssets ?? []).map((asset) => asset.media_path).filter(Boolean));
    const unused = oldPaths.filter((path) => !retained.has(path));
    if (unused.length) await supabase.storage.from('content-creatives').remove(unused);
  }
  await recordEvent(supabase, campaignId, user.id, editingCampaignId ? 'draft_revised' : 'draft_created', null, { platforms, creative_uploaded: Boolean(mediaPath), source_offer_id: offer.id });
  refreshContent();
  redirect(back('drafts', 'success', 'Draft saved. It is private and has not been published.'));
}

export async function submitContentForCeoReview(form: FormData) {
  const { supabase, user } = await contentOperator();
  const campaignId = clean(form.get('campaignId'), 80);
  const { data: campaign } = await supabase.from('content_campaigns').select('*').eq('id', campaignId).maybeSingle();
  if (!campaign || !['draft', 'on_hold', 'changes_requested'].includes(campaign.status)) redirect(back('drafts', 'error', 'Only an editable draft can be sent for CEO review.'));
  const { data: offer } = await supabase.from('offers').select('id,status,destination_url').eq('id', campaign.source_offer_id).maybeSingle();
  if (!offer || offer.status !== 'active' || !offer.destination_url) redirect(back('drafts', 'error', 'The source offer is no longer active. Refresh or replace the deal before review.'));
  const { data: assets, error: assetError } = await supabase.from('content_campaign_assets').select('*').eq('campaign_id', campaignId);
  if (assetError || !assets?.length) redirect(back('drafts', 'error', 'Add at least one social or ad creative before review.'));
  if (assets.some((asset) => (!asset.headline && !asset.caption && !asset.description) || !asset.media_path)) redirect(back('drafts', 'error', 'Every selected destination needs customer copy and an uploaded creative image before CEO review.'));

  const workRows = assets.map((asset) => ({
    title: `Review ${asset.platform_key.replaceAll('_', ' ')} creative: ${campaign.title}`.slice(0, 180),
    summary: `Admin-prepared ${asset.channel_type === 'social' ? 'social' : 'paid ad'} draft for ${String((campaign.offer_snapshot as Record<string, unknown>)?.product ?? 'selected deal')}. Review the copy, private creative, tracked destination, and source offer before forwarding to final admin approval.`,
    area: 'content',
    risk_level: asset.channel_type === 'paid_ads' ? 'high' : 'medium',
    status: 'pending_approval',
    requires_owner_approval: true,
    proposed_by: 'Content Manager (admin-prepared draft)',
    requested_by: user.id,
    context: { content_campaign_id: campaignId, content_asset_id: asset.id, offer_id: campaign.source_offer_id, platform_key: asset.platform_key, channel_type: asset.channel_type },
  }));
  const { data: workItems, error: workError } = await supabase.from('ai_work_items').insert(workRows).select('id,context');
  if (workError || !workItems) redirect(back('drafts', 'error', `CEO review request could not be created: ${workError?.message ?? 'No review records returned.'}`));
  for (const item of workItems) {
    const context = item.context as Record<string, string>;
    const assetId = context.content_asset_id;
    const { error } = await supabase.from('content_campaign_assets').update({ status: 'pending_review', ai_work_item_id: item.id, updated_at: new Date().toISOString() }).eq('id', assetId);
    if (error) throw new Error(error.message);
  }
  const { error: updateError } = await supabase.from('content_campaigns').update({ status: 'pending_review', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', campaignId);
  if (updateError) throw new Error(updateError.message);
  await recordEvent(supabase, campaignId, user.id, 'sent_to_ceo_review', null, { work_item_ids: workItems.map((item) => item.id) });
  refreshContent();
  redirect(back('drafts', 'success', 'Sent to CEO review. This does not publish or spend ad budget.'));
}
