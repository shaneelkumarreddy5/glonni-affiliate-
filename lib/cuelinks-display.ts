type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;

/** Only public listing fields reach the admin UI; never serialize a whole provider response. */
export function cuelinksDisplayRows(value: unknown): { id: string; name: string; description: string; details: string }[] {
  let rows: unknown[] | null = Array.isArray(value) ? value : null;
  const root = record(value);
  if (!rows && root) {
    for (const key of ['campaigns', 'offers', 'data', 'results']) {
      if (Array.isArray(root[key])) { rows = root[key] as unknown[]; break; }
      const nested = record(root[key]);
      if (nested) for (const name of ['campaigns', 'offers', 'results']) if (Array.isArray(nested[name])) { rows = nested[name] as unknown[]; break; }
      if (rows) break;
    }
  }
  const text = (input: unknown) => typeof input === 'string' || typeof input === 'number' ? String(input).slice(0, 240) : '';
  return (rows ?? []).slice(0, 25).flatMap((value, index) => {
    const item = record(value);
    if (!item) return [];
    const details = [
      item.access_status ? `Access: ${text(item.access_status)}` : '',
      item.payout !== undefined && item.payout !== null ? `Payout: ${text(item.payout)} ${text(item.payout_currency)}`.trim() : '',
      item.campaign_name ? `Campaign: ${text(item.campaign_name)}` : '',
      item.offer_type ? `Type: ${text(item.offer_type)}` : '',
      item.coupon_code ? `Code: ${text(item.coupon_code)}` : '',
      item.end_date ? `Ends: ${text(item.end_date)}` : '',
    ].filter(Boolean).join(' · ');
    return [{
      id: text(item.id ?? item.campaign_id ?? item.offer_id) || String(index + 1),
      name: text(item.name ?? item.title ?? item.campaign_name) || 'Untitled provider record',
      description: text(item.description ?? item.offer_type ?? item.category),
      details,
    }];
  });
}

const safeHttpsUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};

export function cuelinksDisplayLink(value: unknown) {
  const root = record(value);
  const nested = record(root?.data) ?? root;
  if (!nested) return null;
  const trackingUrl = safeHttpsUrl(nested.tracking_url);
  if (!trackingUrl) return null;
  const originalUrl = safeHttpsUrl(nested.original_url);
  const campaign = record(nested.campaign);
  return {
    trackingUrl,
    originalUrl,
    affiliated: typeof nested.affiliated === 'boolean' ? nested.affiliated : null,
    campaignName: typeof campaign?.name === 'string' ? campaign.name.slice(0, 160) : null,
  };
}

export function cuelinksErrorMessage(code: string, status?: number) {
  if (status === 401) return 'Sign in again before testing the connection.';
  if (status === 403) return 'An active Owner/Admin account with two-step verification is required.';
  const messages: Record<string, string> = {
    not_configured: 'Add CUELINKS_API_KEY in Supabase → Edge Functions → Secrets, then retry.',
    invalid_credentials: 'Cuelinks rejected the saved key. Replace it in Supabase secrets.',
    missing_scope_or_access: 'The Cuelinks key needs access to campaigns and offers.',
    provider_rate_limited: 'Cuelinks has limited requests. Wait before retrying.',
    timeout: 'Cuelinks took too long to respond. Retry later.',
  };
  return messages[code] || 'The connection test failed. Check the Supabase function logs and retry.';
}
