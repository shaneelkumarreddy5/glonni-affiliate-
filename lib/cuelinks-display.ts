type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;

/** Only public listing fields reach the admin UI; never serialize a whole provider response. */
export function cuelinksDisplayRows(value: unknown): { id: string; name: string; description: string }[] {
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
    return [{ id: text(item.id ?? item.campaign_id ?? item.offer_id) || String(index + 1), name: text(item.name ?? item.title ?? item.campaign_name) || 'Untitled provider record', description: text(item.description ?? item.offer_type ?? item.category) }];
  });
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
