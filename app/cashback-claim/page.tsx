import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CircleAlert, FileSearch, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { submitCashbackClaim } from './actions';
import { SimpleCaptcha } from '@/components/simple-captcha';
import '../wallet/wallet.css';

type Props = { searchParams: Promise<{ error?: string; success?: string }> };
type OfferOption = { id:string; title:string; merchants:{ name:string }|null };
type Claim = { id:string; order_reference:string; purchase_amount:number|null; claimed_amount:number|null; status:string; note:string|null; reviewer_note:string|null; created_at:string; offers:{ title:string; merchants:{ name:string }|null }|null };
const money=(value:number)=>`₹${value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const tone=(status:string)=>['confirmed','paid'].includes(status)?'confirmed':['rejected','reversed'].includes(status)?'rejected':status==='needs_info'?'hold':'pending';

export default async function CashbackClaimPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/cashback-claim');
  const [{ data: offers }, { data: rawClaims }] = await Promise.all([
    supabase.from('offers').select('id,title,merchants(name)').eq('status','active').order('title').limit(200),
    supabase.from('cashback_claims').select('id,order_reference,purchase_amount,claimed_amount,status,note,reviewer_note,created_at,offers(title,merchants(name))').order('created_at',{ascending:false}).limit(100),
  ]);
  const claims=(rawClaims??[]) as unknown as Claim[];
  const offerOptions=(offers??[]) as unknown as OfferOption[];
  return <><Header/><main className="wallet-page claim-page">
    <nav className="wallet-crumb"><Link href="/">Home</Link><span>›</span><Link href="/wallet">Wallet &amp; Payouts</Link><span>›</span><b>Missing cashback</b></nav>
    <header className="wallet-heading"><p>CASHBACK SUPPORT</p><h1>Missing cashback claims</h1><span>Report an eligible purchase and follow every review update without treating an unverified claim as earned cashback.</span></header>
    {params.error&&<p className="auth-notice error" role="alert">{params.error}</p>}{params.success&&<p className="auth-notice success" role="status">{params.success}</p>}
    <section className="claim-layout">
      <article className="claim-form-card"><header><FileSearch/><div><h2>Report missing cashback</h2><p>Use the order details shown by the store.</p></div></header><form action={submitCashbackClaim} className="auth-form"><label>Order reference<input name="orderReference" required minLength={3} maxLength={120} placeholder="Merchant order ID"/></label><label>Related Glonni offer <em>Optional</em><select name="offerId" defaultValue=""><option value="">I cannot find the offer</option>{offerOptions.map((offer)=><option key={offer.id} value={offer.id}>{offer.merchants?.name?`${offer.merchants.name} — `:''}{offer.title}</option>)}</select></label><div className="claim-money-fields"><label>Purchase amount<input name="purchaseAmount" type="number" min="1" step="0.01" required placeholder="0.00"/></label><label>Cashback shown<input name="claimedAmount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label></div><label>Helpful details <em>Optional</em><textarea name="note" rows={4} maxLength={1000} placeholder="Purchase date, store or details that help the review."/></label><SimpleCaptcha/><button type="submit">Submit for review</button></form><p className="claim-rule"><ShieldCheck/>A claim is credited only after affiliate-provider validation.</p></article>
      <aside className="claim-guidance"><CircleAlert/><h2>Before submitting</h2><ol><li>You started shopping through a Glonni tracked link.</li><li>The purchase was not cancelled, returned or refunded.</li><li>The normal tracking period has passed.</li><li>The order reference and amounts match the store receipt.</li></ol><Link href="/cashback-guide">Read the cashback guide</Link></aside>
    </section>
    <section className="wallet-history claim-history"><header className="history-top"><div><h2>Your claim history</h2><p>Newest claims appear first.</p></div><Link href="/wallet">Back to wallet</Link></header>{claims.length?<div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Submitted</th><th>Store / offer</th><th>Order ID</th><th>Purchase</th><th>Claimed</th><th>Status</th><th>Review note</th></tr></thead><tbody>{claims.map(claim=><tr key={claim.id}><td>{new Date(claim.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td><td><b>{claim.offers?.merchants?.name||'Store not selected'}</b><small>{claim.offers?.title||'Offer identification pending'}</small></td><td>{claim.order_reference}</td><td>{money(Number(claim.purchase_amount??0))}</td><td className="cashback-amount">{money(Number(claim.claimed_amount??0))}</td><td><span className={`wallet-status ${tone(claim.status)}`}>{claim.status.replaceAll('_',' ')}</span></td><td>{claim.reviewer_note||'Awaiting review'}</td></tr>)}</tbody></table></div>:<div className="wallet-empty"><FileSearch/><div><h2>No claims submitted</h2><p>If eligible cashback does not track, your submitted claim and its review status will appear here.</p></div></div>}</section>
  </main></>;
}
