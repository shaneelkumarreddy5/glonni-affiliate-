'use client';

import { useState, type CSSProperties } from 'react';
import { Copy, ExternalLink, Loader2, RefreshCw, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Campaign = {
  id: number;
  name: string;
  domain?: string | null;
  access_status?: string | null;
  payout?: string | number | null;
  payout_currency?: string | null;
  cashback_publishers_allowed?: boolean | null;
};
type Offer = {
  id: number;
  title: string;
  description?: string | null;
  coupon_code?: string | null;
  offer_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  percent_off?: number | null;
};
type CuelinksReply = {
  ok?: boolean;
  status?: string;
  message?: string;
  error?: string;
  data?: unknown;
  meta?: { total?: number; next_page?: number | null; prev_page?: number | null };
  note?: string;
};

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5eaf0',
  borderRadius: 14,
  padding: 22,
  margin: '0 0 24px',
  boxShadow: '0 4px 18px rgba(18, 34, 54, .045)',
};
const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #d6dee8',
  borderRadius: 9,
  background: '#fff',
  color: '#19324d',
  padding: '9px 13px',
  fontWeight: 650,
  cursor: 'pointer',
};
const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: '#1767a7',
  background: '#1767a7',
  color: '#fff',
};
const smallText: CSSProperties = { color: '#637487', fontSize: 13, lineHeight: 1.55 };

export function CuelinksConnectionPanel() {
  const [connection, setConnection] = useState<'unknown' | 'connected' | 'not_configured' | 'failed'>('unknown');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  async function invoke(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setNotice('');
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<CuelinksReply>('cuelinks-connector', {
      body: { action, ...payload },
    });
    setBusy('');
    if (error) {
      setConnection('failed');
      setNotice(error.message || 'The Cuelinks request could not complete.');
      return null;
    }
    if (!data?.ok) {
      if (data?.status === 'not_configured') setConnection('not_configured');
      else if (data?.status) setConnection('failed');
      setNotice(data?.message || data?.error || 'Cuelinks could not complete that request.');
      return null;
    }
    setConnection('connected');
    return data;
  }

  async function checkConnection() {
    const data = await invoke('health');
    if (data) setNotice('Cuelinks connection is working.');
  }

  async function loadCampaigns() {
    setOffers([]);
    setSelectedCampaign(null);
    const data = await invoke('campaigns', { page: 1, per_page: 50 });
    if (!data) return;
    const rows = Array.isArray(data.data) ? data.data as Campaign[] : [];
    setCampaigns(rows);
    setNotice(rows.length ? `Loaded ${rows.length} India campaigns for review.` : 'No India campaigns were returned.');
  }

  async function loadOffers(campaign: Campaign) {
    setSelectedCampaign(campaign.id);
    const data = await invoke('offers', { campaign_id: campaign.id, page: 1, per_page: 50 });
    if (!data) return;
    const rows = Array.isArray(data.data) ? data.data as Offer[] : [];
    setOffers(rows);
    setNotice(rows.length ? `Loaded ${rows.length} current offers for ${campaign.name}.` : `No current offers were returned for ${campaign.name}.`);
  }

  async function convertLink() {
    setTrackingUrl('');
    const data = await invoke('convert', { url: linkInput });
    if (!data) return;
    const result = data.data && typeof data.data === 'object' ? data.data as { tracking_url?: string; affiliated?: boolean } : {};
    setTrackingUrl(result.tracking_url || '');
    setNotice(!result.tracking_url ? 'Cuelinks returned no tracking link.' : result.affiliated === false ? 'Link generated, but Cuelinks says this URL is not currently commission-eligible.' : 'Affiliate link generated as a preview. It has not been saved or published.');
  }

  async function copyLink() {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setNotice('Preview link copied. It has not been saved or published.');
    } catch {
      setNotice('Copy failed. Select the link text and copy it manually.');
    }
  }

  const statusLabel = connection === 'connected' ? 'Connected' : connection === 'not_configured' ? 'Key needed' : connection === 'failed' ? 'Check needed' : 'Not checked';
  const statusColor = connection === 'connected' ? '#177245' : connection === 'not_configured' ? '#9a5b00' : connection === 'failed' ? '#a73535' : '#637487';

  return (
    <section style={cardStyle} aria-labelledby="cuelinks-title">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 5px', color: '#1767a7', fontSize: 11, fontWeight: 750, letterSpacing: '.09em' }}>AFFILIATE NETWORK</p>
          <h2 id="cuelinks-title" style={{ margin: '0 0 7px', color: '#18334f', fontSize: 20 }}>Cuelinks</h2>
          <p style={{ ...smallText, margin: 0, maxWidth: 720 }}>Secure connection for India campaigns, current coupons and deals, and affiliate link generation. This panel previews data only; it does not publish offers or change customer redirects.</p>
        </div>
        <span style={{ color: statusColor, background: connection === 'connected' ? '#e8f6ee' : '#f3f5f7', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{statusLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button type="button" style={primaryButtonStyle} onClick={checkConnection} disabled={!!busy}><RefreshCw size={15}/>{busy === 'health' ? 'Checking…' : 'Check connection'}</button>
        <button type="button" style={buttonStyle} onClick={loadCampaigns} disabled={!!busy}><Search size={15}/>{busy === 'campaigns' ? 'Loading…' : 'Load India campaigns'}</button>
        {busy && <span role="status" style={{ ...smallText, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LoaderCircle size={15}/>Working…</span>}
      </div>

      {notice && <p role="status" aria-live="polite" style={{ margin: '13px 0 0', color: connection === 'failed' || connection === 'not_configured' ? statusColor : '#38546e', fontSize: 13 }}>{notice}</p>}

      {campaigns.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ ...smallText, marginBottom: 8 }}>India campaigns · choose a campaign to review its current offers. Cashback eligibility is shown from Cuelinks campaign terms.</div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 370, overflow: 'auto' }}>
            {campaigns.map((campaign) => (
              <article key={campaign.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '12px 14px', border: '1px solid #e8edf2', borderRadius: 10, background: selectedCampaign === campaign.id ? '#f4f9fd' : '#fff' }}>
                <div>
                  <strong style={{ display: 'block', color: '#1b3550', fontSize: 14 }}>{campaign.name}</strong>
                  <span style={smallText}>{campaign.domain || 'Merchant domain not provided'} · Access: {campaign.access_status || 'not specified'} · Cashback: {campaign.cashback_publishers_allowed === true ? 'allowed by campaign' : campaign.cashback_publishers_allowed === false ? 'not allowed by campaign' : 'check terms'}</span>
                  {campaign.payout != null && <span style={{ ...smallText, display: 'block' }}>Payout: {campaign.payout} {campaign.payout_currency || 'INR'}</span>}
                </div>
                <button type="button" style={buttonStyle} onClick={() => loadOffers(campaign)} disabled={!!busy}><ExternalLink size={14}/>{busy === 'offers' && selectedCampaign === campaign.id ? 'Loading offers…' : 'View offers'}</button>
              </article>
            ))}
          </div>
        </div>
      )}

      {offers.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px', color: '#1b3550', fontSize: 15 }}>Current offers</h3>
          <div style={{ display: 'grid', gap: 8, maxHeight: 330, overflow: 'auto' }}>
            {offers.map((offer) => (
              <article key={offer.id} style={{ padding: '12px 14px', border: '1px solid #e8edf2', borderRadius: 10 }}>
                <strong style={{ display: 'block', color: '#1b3550', fontSize: 14 }}>{offer.title}</strong>
                <span style={smallText}>{offer.offer_type || 'offer'}{offer.coupon_code ? ` · Code: ${offer.coupon_code}` : ''}{offer.percent_off != null ? ` · ${offer.percent_off}% off` : ''}</span>
                <span style={{ ...smallText, display: 'block' }}>Valid: {offer.start_date || 'start not specified'} to {offer.end_date || 'end not specified'}</span>
              </article>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #edf0f4' }}>
        <label htmlFor="cuelinks-url" style={{ display: 'block', color: '#1b3550', fontSize: 13, fontWeight: 700, marginBottom: 7 }}>Generate a preview tracking link</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="cuelinks-url" type="url" value={linkInput} onChange={(event) => setLinkInput(event.target.value)} placeholder="https://merchant.in/product" style={{ minWidth: 260, flex: '1 1 360px', border: '1px solid #d6dee8', borderRadius: 9, padding: '10px 12px' }}/>
          <button type="button" style={buttonStyle} onClick={convertLink} disabled={!!busy || !linkInput.trim()}>{busy === 'convert' ? 'Generating…' : 'Generate link'}</button>
        </div>
        {trackingUrl && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
          <code style={{ maxWidth: '100%', overflowWrap: 'anywhere', color: '#38546e', fontSize: 12 }}>{trackingUrl}</code>
          <button type="button" style={buttonStyle} onClick={copyLink}><Copy size={14}/>Copy</button>
        </div>}
        <p style={{ ...smallText, margin: '8px 0 0' }}>A generated preview is not a published offer or a customer click. The key stays in Supabase and is never sent to the browser.</p>
      </div>
    </section>
  );
}
