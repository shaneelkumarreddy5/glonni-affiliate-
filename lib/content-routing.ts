export type ContentChannel = 'social' | 'paid_ads';

export function managerPathForContentChannel(channel: ContentChannel) {
  return channel === 'social' ? '/admin/social-manager' : '/admin/ads';
}

export function isReadyForChannelQueue(asset: { status?: string | null; channel_type?: string | null }, channel: ContentChannel) {
  return asset.status === 'admin_approved' && asset.channel_type === channel;
}

export function campaignStatusAfterCeoReviews(statuses: string[]) {
  const terminal = statuses.length > 0 && statuses.every((status) => ['approved', 'rejected', 'on_hold'].includes(status));
  if (!terminal) return 'pending_review';
  if (statuses.includes('approved')) return 'approved';
  return statuses.every((status) => status === 'rejected') ? 'rejected' : 'on_hold';
}

export function campaignStatusAfterFinalApprovals(statuses: string[]) {
  const terminal = statuses.length > 0 && statuses.every((status) => ['admin_approved', 'rejected'].includes(status));
  if (!terminal) return 'approved';
  return statuses.includes('admin_approved') ? 'admin_approved' : 'rejected';
}
