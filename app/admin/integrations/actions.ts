'use server';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { customerAdminClient } from '@/lib/admin-customers';
import { cuelinksDisplayLink, cuelinksDisplayRows, cuelinksErrorMessage } from '@/lib/cuelinks-display';

export async function checkCuelinks(action: 'health' | 'campaigns' | 'offers', query = '') {
  if (!['health', 'campaigns', 'offers'].includes(action)) throw new Error('Unsupported connection check');
  const supabase = await customerAdminClient();
  const empty = { rows: [] as ReturnType<typeof cuelinksDisplayRows>, checkedAt: '' };
  try {
    const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';
    const { data, error } = await supabase.functions.invoke('cuelinks', { body: { action, page: 1, per_page: 25, ...(q ? { q } : {}) } });
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
export async function convertCuelinksLink(url: string) {
  if (typeof url !== 'string' || url.length > 2048) throw new Error('Enter a merchant link of 2,048 characters or fewer.');
  const supabase = await customerAdminClient();
  try {
    const { data, error } = await supabase.functions.invoke('cuelinks', { body: { action: 'convert_link', url: url.trim() } });
    if (error) {
      let code = '', status: number | undefined;
      if (error instanceof FunctionsHttpError) {
        status = error.context.status;
        try { const body = await error.context.json(); code = typeof body?.code === 'string' ? body.code : ''; } catch { /* Gateway failures may not contain JSON. */ }
      }
      return { ok: false, link: null, message: cuelinksErrorMessage(code, status) };
    }
    if (data?.provider !== 'cuelinks' || data?.action !== 'convert_link') return { ok: false, link: null, message: 'Cuelinks returned an unexpected response.' };
    const link = cuelinksDisplayLink(data.data);
    if (!link) return { ok: false, link: null, message: 'Cuelinks did not return a valid HTTPS tracking link.' };
    return {
      ok: true,
      link,
      message: link.affiliated === false
        ? 'Link generated, but Cuelinks reports this campaign is not currently approved or active. Do not publish it as a commission-earning offer yet.'
        : 'Tracked link generated. Review the destination and campaign access before adding it to a live offer.',
    };
  } catch {
    return { ok: false, link: null, message: 'The connector could not be reached. Retry after checking the Supabase function.' };
  }
}
