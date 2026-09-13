'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedPlacements=['top_deals','trending','price_drops','cashback_picks','collection'];
const rewardTypes=['none','fixed_cashback','percentage_cashback','coupon','merchant_promotion'];
const stockStates=['unknown','in_stock','low_stock','out_of_stock','preorder'];
const numberOrNull=(value:FormDataEntryValue|null)=>{const raw=String(value??'').trim();return raw===''?null:Number(raw)};
const textOrNull=(value:FormDataEntryValue|null)=>String(value??'').trim()||null;

async function operator(ownerOnly=false){
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login');
  const [{data:profile},{data:employee}]=await Promise.all([supabase.from('profiles').select('role').eq('id',user.id).single(),supabase.from('employees').select('status').eq('profile_id',user.id).single()]);
  const roles=ownerOnly?['owner','admin']:['owner','admin','editor'];
  if(!profile||!roles.includes(profile.role)||!employee||employee.status!=='active'||assurance?.currentLevel!=='aal2')throw new Error('An active staff account with 2FA is required.');
  return {supabase,user};
}

function parseBankOffers(value:FormDataEntryValue|null){
  return String(value??'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>({description:line}));
}

function quality(payload:{url:string;price:number|null;terms:string|null;reward:string;stock:string}){
  const issues:string[]=[];
  if(!payload.url)issues.push('Missing destination URL');
  if(payload.price===null||payload.price<0)issues.push('Missing current price');
  if(payload.stock==='unknown')issues.push('Stock not verified');
  if(['fixed_cashback','percentage_cashback'].includes(payload.reward)&&!payload.terms)issues.push('Cashback terms missing');
  return {issues,score:Math.max(0,100-issues.length*20)};
}

export async function saveOffer(formData:FormData){
  const {supabase,user}=await operator();
  const id=String(formData.get('offerId')??''),product_id=String(formData.get('product')??''),merchant_id=String(formData.get('merchant')??''),provider_id=textOrNull(formData.get('provider'));
  const destination_url=String(formData.get('url')??'').trim(),current_price=numberOrNull(formData.get('price')),list_price=numberOrNull(formData.get('listPrice'));
  const reward_type=String(formData.get('rewardType')??'none'),stock_status=String(formData.get('stockStatus')??'unknown'),reward_terms=textOrNull(formData.get('rewardTerms'));
  if(!product_id||!merchant_id||!destination_url)throw new Error('Product, store and destination URL are required.');
  if(!rewardTypes.includes(reward_type)||!stockStates.includes(stock_status))throw new Error('Invalid offer option.');
  const check=quality({url:destination_url,price:current_price,terms:reward_terms,reward:reward_type,stock:stock_status});
  const payload={product_id,merchant_id,provider_id,destination_url,current_price,list_price,commission_rate:numberOrNull(formData.get('commissionRate')),commission_amount:numberOrNull(formData.get('commissionAmount')),reward_type,cashback_amount:reward_type==='fixed_cashback'?numberOrNull(formData.get('cashback')):null,cashback_percent:reward_type==='percentage_cashback'?numberOrNull(formData.get('cashbackPercent')):null,cashback_cap:reward_type==='percentage_cashback'?numberOrNull(formData.get('cashbackCap')):null,coupon_code:reward_type==='coupon'?textOrNull(formData.get('couponCode')):null,reward_terms,cashback_tracking_supported:['fixed_cashback','percentage_cashback'].includes(reward_type),reward_funding_source:['fixed_cashback','percentage_cashback'].includes(reward_type)?String(formData.get('fundingSource')??'glonni'):'none',bank_offer:textOrNull(formData.get('bankOffer')),bank_offers:parseBankOffers(formData.get('bankOffers')),customer_rating:numberOrNull(formData.get('rating')),rating_count:numberOrNull(formData.get('ratingCount')),stock_status,cashback_confirmation_days:numberOrNull(formData.get('cashbackDays')),variant_label:textOrNull(formData.get('variantLabel')),starts_at:textOrNull(formData.get('startsAt')),ends_at:textOrNull(formData.get('endsAt')),quality_score:check.score,quality_issues:check.issues,last_checked_at:new Date().toISOString(),status:'draft' as const,review_status:'draft'};
  const result=id?await supabase.from('offers').update(payload).eq('id',id).select('id').single():await supabase.from('offers').insert(payload).select('id').single();
  if(result.error)throw new Error(result.error.message);
  await supabase.from('audit_events').insert({event_type:id?'offer_updated':'offer_created',entity_type:'offer',entity_id:result.data.id,source:'admin',metadata:{actor_id:user.id,quality_score:check.score}});
  revalidatePath('/admin/offers');revalidatePath('/admin/products');
  redirect(`/admin/offers?tab=all&review=${result.data.id}&success=${encodeURIComponent(id?'Offer draft updated':'Offer draft created')}`);
}

export async function changeOfferReviewStatus(formData:FormData){
  const action=String(formData.get('action')??''),ownerOnly=['approve','reject'].includes(action),{supabase,user}=await operator(ownerOnly);
  const id=String(formData.get('offerId')??'');
  const {data:offer,error}=await supabase.from('offers').select('id,destination_url,current_price,reward_type,reward_terms,cashback_tracking_supported,stock_status').eq('id',id).single();
  if(error||!offer)throw new Error('Offer not found.');
  let update:Record<string,unknown>,message='Offer updated';
  if(action==='submit'){
    if(!offer.destination_url||offer.current_price===null)throw new Error('Destination URL and price are required before review.');
    update={review_status:'in_review',status:'draft',submitted_at:new Date().toISOString()};message='Offer submitted for review';
  }else if(action==='approve'){
    if(offer.reward_type!=='none'&&['fixed_cashback','percentage_cashback'].includes(offer.reward_type)&&(!offer.cashback_tracking_supported||!offer.reward_terms))throw new Error('Cashback tracking and approved terms are required.');
    update={review_status:'approved',status:'active',reviewed_at:new Date().toISOString(),reviewed_by:user.id,last_checked_at:new Date().toISOString()};message='Offer approved and activated';
  }else if(action==='reject'){
    update={review_status:'rejected',status:'inactive',reviewed_at:new Date().toISOString(),reviewed_by:user.id};message='Offer rejected';
  }else if(action==='expire'){
    update={status:'expired'};message='Offer expired';
  }else throw new Error('Invalid offer action.');
  const {error:updateError}=await supabase.from('offers').update(update).eq('id',id);if(updateError)throw new Error(updateError.message);
  await supabase.from('audit_events').insert({event_type:`offer_${action}`,entity_type:'offer',entity_id:id,source:'admin',metadata:{actor_id:user.id}});
  revalidatePath('/admin/offers');revalidatePath('/admin/products');revalidatePath('/');
  redirect(`/admin/offers?tab=${action==='submit'?'approval':'all'}&review=${id}&success=${encodeURIComponent(message)}`);
}

export async function publishOfferPlacements(formData:FormData){
  const {supabase,user}=await operator(true);
  const offerId=String(formData.get('offerId')??''),placements=formData.getAll('placement').map(String).filter(value=>allowedPlacements.includes(value));
  if(!offerId||!placements.length)throw new Error('Select an offer and at least one approved placement.');
  const {data:offer,error:offerError}=await supabase.from('offers').select('id,status,review_status,reward_type,reward_terms,cashback_tracking_supported,products(title)').eq('id',offerId).single();
  if(offerError||!offer)throw new Error('Offer not found.');
  if(offer.status!=='active'||offer.review_status!=='approved')throw new Error('Approve and activate the offer before creating placements.');
  if(['fixed_cashback','percentage_cashback'].includes(offer.reward_type)&&(!offer.cashback_tracking_supported||!offer.reward_terms))throw new Error('Cashback tracking and approved reward terms are required before publishing.');
  const product=offer.products as unknown as {title?:string}|null;
  const now=new Date().toISOString(),displayOrder=Math.max(1,Number(formData.get('displayOrder'))||1),device=String(formData.get('device')??'all');
  const rows=placements.map((placement,index)=>({title:`${product?.title||'Approved offer'} · ${placement.replaceAll('_',' ')}`,placement,device:['all','desktop','mobile'].includes(device)?device:'all',offer_id:offerId,display_order:displayOrder+index,status:'draft',starts_at:String(formData.get('startsAt')??'')||null,ends_at:String(formData.get('endsAt')??'')||null,created_by:user.id,approved_by:user.id,approved_at:now}));
  const {data,error}=await supabase.from('homepage_campaigns').insert(rows).select('id');
  if(error)throw new Error(error.message);
  await supabase.from('audit_events').insert({event_type:'offer_placements_published',entity_type:'offer',entity_id:offerId,source:'admin',metadata:{placements,campaign_ids:(data??[]).map(row=>row.id),actor_id:user.id}});
  revalidatePath('/admin/offers');revalidatePath('/admin/campaigns');revalidatePath('/');
  redirect(`/admin/campaigns?campaign=${data?.[0]?.id||''}&step=distribution&success=${encodeURIComponent('Campaign draft created — choose placements and complete final approval')}`);
}
