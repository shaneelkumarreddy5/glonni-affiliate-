import type { SupabaseClient } from '@supabase/supabase-js';

/** Read complete queues through the signed-in client's RLS, never silently truncated totals. */
export async function readOperationalRows<T>(client: SupabaseClient, table: string, columns: string): Promise<{ rows: T[]; failed: boolean }> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    try {
      const { data, error } = await client.from(table).select(columns).order('id').range(offset, offset + pageSize - 1);
      if (error || !data) return { rows: [], failed: true };
      rows.push(...data as unknown as T[]);
      if (data.length < pageSize) return { rows, failed: false };
    } catch { return { rows: [], failed: true }; }
  }
  // A large queue requires a server-side report; do not show a partial balance as a total.
  return { rows: [], failed: true };
}
