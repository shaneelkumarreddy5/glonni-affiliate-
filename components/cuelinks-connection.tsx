'use client';

import { useState, useTransition } from 'react';
import { checkCuelinks } from '@/app/admin/integrations/actions';

export function CuelinksConnection({ canTest }: { canTest: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkCuelinks>> | null>(null);
  function run(action: 'health' | 'campaigns' | 'offers') {
    setResult(null);
    startTransition(async () => {
      try { setResult(await checkCuelinks(action)); }
      catch { setResult({ ok: false, rows: [], checkedAt: '', message: 'Sign in with an active Owner/Admin account and complete two-step verification, then retry.' }); }
    });
  }
  return <article className="integration-connector"><h2>Cuelinks connection</h2><p>Check the existing server-side connector before importing provider data. The saved API key is never displayed here.</p>
    <div className="integration-buttons"><button disabled={!canTest || pending} onClick={() => run('health')}>Test connection</button><button disabled={!canTest || pending} onClick={() => run('campaigns')}>Read campaigns</button><button disabled={!canTest || pending} onClick={() => run('offers')}>Read offers</button></div>
    {!canTest && <p>Owner/Admin access and two-step verification are required.</p>}
    {pending && <p role="status">Checking Cuelinks…</p>}
    {result && <div role={result.ok ? 'status' : 'alert'} className={result.ok ? 'integration-result' : 'integration-result error'}><p>{result.message}</p>{result.checkedAt && <small>Checked {new Date(result.checkedAt).toLocaleString('en-IN')}</small>}{result.rows.length > 0 && <div className="table-scroll"><table><thead><tr><th>PROVIDER ID</th><th>NAME</th><th>DESCRIPTION</th></tr></thead><tbody>{result.rows.map((row, index) => <tr key={row.id + ':' + index}><td>{row.id}</td><td>{row.name}</td><td>{row.description || '—'}</td></tr>)}</tbody></table></div>}</div>}
  </article>;
}
