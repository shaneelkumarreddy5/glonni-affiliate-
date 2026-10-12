'use server';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { customerAdminClient } from '@/lib/admin-customers';
import { cuelinksDisplayRows, cuelinksErrorMessage } from '@/lib/cuelinks-display';

export async function checkCuelinks(action: 'health' | 'campaigns' | 'offers') {
  if (!['health', 'campaigns', 'offers'].includes(action)) throw new Error('Unsupported connection check');
  const supabase = await customerAdminClient();
  const empty = { rows: [] as ReturnType<typeof cuelinksDisplayRows>, checkedAt: '' };
  try {
    const { data, error } = await supabase.functions.invoke('cuelinks', { body: { action, page: 1, per_page: 25 } });
    if (error) {
      let code = '', status: number | undefined;
      if (error instanceof FunctionsHttpError) {
        status = error.context.status;
        try { const body = await error.context.json(); code = typeof body?.code === 'string' ? body.code : ''; } catch { /* Gateway failures may not contain JSON. */ }
      }
      return { ...empty, ok: false, message: cuelinksErrorMessage(code, status) };
    }
    if (data?.provider !== 'cuelinks' || data?.action !== action || data?.data == null) return { ...empty, ok: false, message: 'The connector returned an unexpected response. No catalogue data was changed.' };
    const rows = action === 'health' ? [] : cuelinksDisplayRows(data.data);
    return { ok: true, rows, checkedAt: new Date().toISOString(), message: action === 'health' ? 'Cuelinks responded successfully. This check did not import or publish anything.' : `Cuelinks responded. Showing ${rows.length} readable records from the first page; nothing was imported or published.` };
  } catch {
    return { ...empty, ok: false, message: 'The connector could not be reached. Retry after checking the Supabase function.' };
  }
}
