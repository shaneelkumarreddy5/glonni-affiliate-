'use client';

import { BellRing, Check, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import './price-alert-button.css';

export function PriceAlertButton({ offerId, productTitle, price, compact = false }: { offerId: string; productTitle: string; price: number; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState<'target_price' | 'deal_expiry'>('target_price');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('price_alerts').select('id').eq('profile_id', user.id).eq('offer_id', offerId).eq('is_active', true).limit(1);
      setSaved(Boolean(data?.length));
    });
  }, [offerId]);

  async function saveAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    const targetPrice = Number(form.get('targetPrice'));
    if (type === 'target_price' && (!Number.isFinite(targetPrice) || targetPrice < 0)) { setError('Enter a valid target price.'); return; }
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
    const { error: saveError } = await supabase.from('price_alerts').upsert({ profile_id: user.id, offer_id: offerId, alert_type: type, target_price: type === 'target_price' ? targetPrice : null }, { onConflict: 'profile_id,offer_id,alert_type' });
    if (saveError) { setError('We could not save that alert. Please try again.'); return; }
    setSaved(true); setOpen(false);
  }

  return <><button type="button" className={`price-alert-button ${saved ? 'enabled' : ''} ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)}>{saved ? <><Check size={15}/>Alert saved</> : <><BellRing size={15}/>Set price alert</>}</button>{open && <div className="alert-modal-backdrop" role="presentation"><form className="alert-modal" onSubmit={saveAlert}><button type="button" aria-label="Close" className="alert-close" onClick={() => setOpen(false)}><X size={17}/></button><p>PRICE ALERT</p><h2>Track {productTitle}</h2><span>Current listed price: ₹{price.toLocaleString('en-IN')}</span><label>Alert type<select value={type} onChange={(event) => setType(event.target.value as 'target_price' | 'deal_expiry')}><option value="target_price">Tell me when the price drops</option><option value="deal_expiry">Remind me before this deal may end</option></select></label>{type === 'target_price' && <label>Target price<input name="targetPrice" type="number" min="0" max={price} step="1" defaultValue={Math.max(0, Math.round(price * .9))}/></label>}{error && <small className="alert-error">{error}</small>}<button className="primary" type="submit">Save alert</button></form></div>}</>;
}
