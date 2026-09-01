import Link from 'next/link';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { submitCashbackClaim } from './actions';

type Props = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function CashbackClaimPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: offers } = await supabase.from('offers').select('id,title').eq('status', 'active').order('title').limit(100);

  return <><Header/><main className="auth-page"><section className="auth-card"><p className="eyebrow">CASHBACK SUPPORT</p><h1>Report missing cashback</h1><p className="auth-intro">Submit a claim only for an offer that showed Glonni Cashback. We review it before any wallet credit is made.</p>
    {params.error && <p className="auth-notice error">{params.error}</p>}
    {params.success && <p className="auth-notice success">{params.success}</p>}
    <form action={submitCashbackClaim} className="auth-form"><label>Order reference<input name="orderReference" required minLength={3} placeholder="Your merchant order ID"/></label><label>Offer (optional)<select name="offerId" defaultValue=""><option value="">I cannot find the offer</option>{(offers ?? []).map((offer) => <option key={offer.id} value={offer.id}>{offer.title}</option>)}</select></label><label>Purchase amount<input name="purchaseAmount" type="number" min="1" step="0.01" required placeholder="0.00"/></label><label>Cashback shown on the offer<input name="claimedAmount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Helpful details (optional)<textarea name="note" rows={3} maxLength={1000} placeholder="Store, purchase date or anything that helps us review."/></label><button type="submit">Submit claim for review</button></form>
    <p className="auth-footnote">Submitting a claim does not guarantee cashback. Confirmed merchant eligibility is required. <Link href="/cashback-guide">Read the cashback guide</Link></p>
  </section></main></>;
}
