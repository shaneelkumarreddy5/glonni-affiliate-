'use client';

import { useState, type FormEvent } from 'react';
import { checkCuelinks, convertCuelinksLink } from '@/app/admin/integrations/actions';

export function CuelinksConnection({ canTest }: { canTest: boolean }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkCuelinks>> | null>(null);
  const [linkResult, setLinkResult] = useState<Awaited<ReturnType<typeof convertCuelinksLink>> | null>(null);
  const [query, setQuery] = useState('');
  const [merchantUrl, setMerchantUrl] = useState('');
  const [copied, setCopied] = useState(false);

  async function run(action: 'health' | 'campaigns' | 'offers') {
    setPending(true);
    setResult(null);
    try { setResult(await checkCuelinks(action, query)); }
    catch { setResult({ ok: false, rows: [], checkedAt: '', message: 'Sign in with an active Owner/Admin account and complete two-step verification, then retry.' }); }
    finally { setPending(false); }
  }

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setLinkResult(null);
    setCopied(false);
    try { setLinkResult(await convertCuelinksLink(merchantUrl)); }
    catch { setLinkResult({ ok: false, link: null, message: 'Sign in with an active Owner/Admin account and complete two-step verification, then retry.' }); }
    finally { setPending(false); }
  }

  async function copyLink() {
    if (!linkResult?.link?.trackingUrl) return;
    try {
      await navigator.clipboard.writeText(linkResult.link.trackingUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <article className="integration-connector">
    <h2>Cuelinks connection</h2>
    <p>The saved API key stays server-side. This uses Cuelinks’ API directly—no Java installation or browser SDK is needed.</p>
    <div className="integration-buttons">
      <button disabled={!canTest || pending} onClick={() => run('health')}>Test connection</button>
      <button disabled={!canTest || pending} onClick={() => run('campaigns')}>Read campaigns</button>
      <button disabled={!canTest || pending} onClick={() => run('offers')}>Read offers</button>
    </div>
    {!canTest && <p>Owner/Admin access and two-step verification are required.</p>}
    <form className="cuelinks-search" onSubmit={event => { event.preventDefault(); void run('campaigns'); }}>
      <label htmlFor="cuelinks-search">Find a brand or campaign</label>
      <input id="cuelinks-search" type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Amazon, Flipkart, Myntra…" />
      <span className="cuelinks-search-actions"><button disabled={!canTest || pending}>Search campaigns</button><button type="button" disabled={!canTest || pending} onClick={() => void run('offers')}>Search offers</button></span>
    </form>
    {pending && <p role="status">Contacting Cuelinks…</p>}
    {result && <div role={result.ok ? 'status' : 'alert'} className={result.ok ? 'integration-result' : 'integration-result error'}>
      <p>{result.message}</p>
      {result.checkedAt && <small>Checked {new Date(result.checkedAt).toLocaleString('en-IN')}</small>}
      {result.rows.length > 0 && <div className="table-scroll"><table><thead><tr><th>ID</th><th>CAMPAIGN / OFFER</th><th>DESCRIPTION</th><th>DETAILS</th></tr></thead><tbody>{result.rows.map((row, index) => <tr key={row.id + ':' + index}><td>{row.id}</td><td>{row.name}</td><td>{row.description || '—'}</td><td>{row.details || '—'}</td></tr>)}</tbody></table></div>}
    </div>}
    <form className="cuelinks-convert" onSubmit={convert}>
      <label htmlFor="cuelinks-merchant-url">Convert a merchant/product URL into a tracked link</label>
      <div><input id="cuelinks-merchant-url" type="url" required maxLength={2048} value={merchantUrl} onChange={event => setMerchantUrl(event.target.value)} placeholder="https://www.flipkart.com/product-page" /><button disabled={!canTest || pending}>Generate tracking link</button></div>
      <small>Paste the resulting URL into the relevant product offer in the catalogue. Check campaign access first; an unapproved campaign will not earn commission.</small>
    </form>
    {linkResult && <div role={linkResult.ok && linkResult.link?.affiliated !== false ? 'status' : 'alert'} className={linkResult.ok && linkResult.link?.affiliated !== false ? 'integration-result' : 'integration-result error'}>
      <p>{linkResult.message}</p>
      {linkResult.link && <><p>{linkResult.link.campaignName ? `Campaign: ${linkResult.link.campaignName}` : 'Campaign was not identified for this URL.'}</p><div className="cuelinks-generated-link"><input aria-label="Generated Cuelinks tracking URL" readOnly value={linkResult.link.trackingUrl} /><button type="button" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button></div></>}
    </div>}
    <p className="cuelinks-note">Campaigns and coupons/deals can be read from Cuelinks. It does not supply merchant product feeds, so product titles, images and prices still need to come from your product source or be added in the catalogue. Reads here are previews only; they do not import or publish anything.</p>
  </article>;
}
