'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedPlacements=['top_deals','trending','price_drops','cashback_picks','collection'];
export async function publishOfferPlacements(formData:FormData){
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login');
  const [{data:profile},{data:employee}]=await Promise.all([supabase.from('profiles').select('role').eq('id',user.id).single(),supabase.from('employees').select('status').eq('profile_id',user.id).single()]);
  if(!profile||!['owner','admin'].includes(profile.role)||!employee||employee.status!=='active'||assurance?.currentLevel!=='aal2')throw new Error('A verified Owner or Admin 2FA session is required to publish offers.');
  const offerId=String(formData.get('offerId')??''),placements=formData.getAll('placement').map(String).filter(value=>allowedPlacements.includes(value));
  if(!offerId||!placements.length)throw new Error('Select an offer and at least one approved placement.');
  const {data:offer,error:offerError}=await supabase.from('offers').select('id,status,reward_type,reward_terms,cashback_tracking_supported,products(title)').eq('id',offerId).single();
  if(offerError||!offer)throw new Error('Offer not found.');
  if(['expired','inactive'].includes(offer.status))throw new Error('Only an active or reviewed draft offer can be published.');
  if(['fixed_cashback','percentage_cashback'].includes(offer.reward_type)&&(!offer.cashback_tracking_supported||!offer.reward_terms))throw new Error('Cashback tracking and approved reward terms are required before publishing.');
  const product=offer.products as unknown as {title?:string}|null;
  const now=new Date().toISOString(),displayOrder=Math.max(1,Number(formData.get('displayOrder'))||1),device=String(formData.get('device')??'all');
  const rows=placements.map((placement,index)=>({title:`${product?.title||'Approved offer'} · ${placement.replaceAll('_',' ')}`,placement,device:['all','desktop','mobile'].includes(device)?device:'all',offer_id:offerId,display_order:displayOrder+index,status:'published',starts_at:String(formData.get('startsAt')??'')||null,ends_at:String(formData.get('endsAt')??'')||null,created_by:user.id,approved_by:user.id,approved_at:now}));
  const {data,error}=await supabase.from('homepage_campaigns').insert(rows).select('id');
  if(error)throw new Error(error.message);
  await supabase.from('audit_events').insert({event_type:'offer_placements_published',entity_type:'offer',entity_id:offerId,source:'admin',metadata:{placements,campaign_ids:(data??[]).map(row=>row.id),actor_id:user.id}});
  revalidatePath('/admin/offers');revalidatePath('/admin/campaigns');revalidatePath('/');
  redirect(`/admin/offers?tab=collections&success=${encodeURIComponent('Offer approved and published to selected placements')}#collections`);
}
