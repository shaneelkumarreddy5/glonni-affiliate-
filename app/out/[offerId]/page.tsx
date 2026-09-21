import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { hasCashback,rewardLabel } from '@/lib/rewards';
import { notFound } from 'next/navigation';
import { applyPublicOfferFilters } from '@/lib/product-publication-rules';

export const dynamic='force-dynamic';

export default async function OfferHandoff({params,searchParams}:{params:Promise<{offerId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const offerId=(await params).offerId,context=await searchParams; const supabase=await createClient();
  const {data:offer}=await applyPublicOfferFilters(supabase.from('offers').select('id,current_price,list_price,reward_type,cashback_amount,cashback_percent,cashback_cap,coupon_code,reward_terms,cashback_tracking_supported,products!inner(title,slug,image_url),merchants!inner(name)').eq('id',offerId)).maybeSingle();
  if(!offer)notFound(); const product=offer.products as unknown as {title:string;slug:string;image_url:string|null}; const merchant=offer.merchants as unknown as {name:string};
  const tracking=new URLSearchParams();for(const key of ['source','medium','campaign','placement','utm_source','utm_medium','utm_campaign']){const value=context[key];if(typeof value==='string'&&value.trim())tracking.set(key,value.trim().slice(0,120));}const goUrl=`/go/${offer.id}${tracking.size?`?${tracking.toString()}`:''}`;
  return <><Header/><main className="handoff-page"><section className="handoff-card"><p className="eyebrow">OFFER CHECK</p><h1>You’re heading to {merchant.name}</h1><p className="muted">Review this offer before you leave Glonni. Checkout, payment, delivery, returns and refunds are handled by the merchant.</p><article className="handoff-offer"><img src={product.image_url||''} alt={product.title}/><div><small>{merchant.name}</small><h2>{product.title}</h2><b>₹{offer.current_price?.toLocaleString('en-IN')}</b>{offer.list_price&&<del>₹{offer.list_price.toLocaleString('en-IN')}</del>}<strong className={hasCashback(offer)?'cashback':''}>{rewardLabel(offer)}</strong></div></article><div className="handoff-points"><p><b>✓ Price:</b> shown by {merchant.name}; verify final price on their website.</p>{hasCashback(offer)?<p><b>✓ Cashback:</b> eligible for this exact offer{offer.reward_terms?`. ${offer.reward_terms}`:'. Merchant confirmation may be required.'}</p>:<p><b>✓ Customer reward:</b> no Glonni Cashback applies to this offer.</p>}<p><b>✓ Your next step:</b> you will complete your purchase securely on {merchant.name}.</p></div><div className="handoff-actions"><a className="secondary" href={`/product/${product.slug}`}>Go back</a><a className="primary" href={goUrl}>Continue to {merchant.name} →</a></div><p className="disclosure">Glonni may earn a commission from qualifying links. This does not change the price you pay.</p></section></main></>;
}
