import { createClient } from '@/lib/supabase/server';

export async function loadApprovedContentQueue(channel: 'social' | 'paid_ads') {
  const supabase = await createClient();
  const { data: assets, error } = await supabase
    .from('content_campaign_assets')
    .select('id,campaign_id,platform_key,creative_format,headline,caption,description,cta_label,media_path,destination_url,updated_at')
    .eq('status', 'admin_approved')
    .eq('channel_type', channel)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error || !assets?.length) return { queue: [], error: error?.message ?? null };

  const campaignIds = [...new Set(assets.map(asset => asset.campaign_id))];
  const { data: campaigns } = await supabase
    .from('content_campaigns')
    .select('id,title,source_offer_id,offer_snapshot,admin_brief')
    .in('id', campaignIds);
  const campaignById = new Map((campaigns ?? []).map(campaign => [campaign.id, campaign]));
  const paths = [...new Set(assets.map(asset => asset.media_path).filter(Boolean))] as string[];
  const signed = await Promise.all(paths.map(async path => {
    const { data } = await supabase.storage.from('content-creatives').createSignedUrl(path, 1800);
    return [path, data?.signedUrl ?? null] as const;
  }));
  const signedByPath = new Map(signed);

  return {
    queue: assets.map(asset => ({
      ...asset,
      campaign: campaignById.get(asset.campaign_id) ?? null,
      mediaUrl: asset.media_path ? signedByPath.get(asset.media_path) ?? null : null,
    })).filter(asset => asset.campaign),
    error: null,
  };
}
