'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type FinancialConversion = {
  id:string;match_status:string;status:string;profile_id:string|null;order_value:number|null;commission_amount:number|null;
  reward_type_snapshot:string|null;cashback_fixed_snapshot:number|null;cashback_percent_snapshot:number|null;
  cashback_cap_snapshot:number|null;reward_funding_source_snapshot:string|null;cashback_tracking_supported_snapshot:boolean|null;
  commission_rate_snapshot:number|null;commission_fixed_snapshot:number|null;
};

const rounded = (value:number) => Math.round(value * 100) / 100;
async function operator() {
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login');
  const [{data:profile},{data:employee}]=await Promise.all([supabase.from('profiles').select('role').eq('id',user.id).single(),supabase.from('employees').select('status').eq('profile_id',user.id).single()]);
  if(!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active'||assurance?.currentLevel!=='aal2')throw new Error('An active Owner or Admin with 2FA is required.');
  return {supabase,user};
}

function calculate(row:FinancialConversion){
  const order=Number(row.order_value??0),commission=row.commission_amount==null?null:Number(row.commission_amount);
  const expected=row.commission_fixed_snapshot!=null?Number(row.commission_fixed_snapshot):row.commission_rate_snapshot!=null?rounded(order*Number(row.commission_rate_snapshot)/100):null;
  let cashback=0;
  if(row.cashback_tracking_supported_snapshot&&row.reward_type_snapshot==='fixed_cashback')cashback=Number(row.cashback_fixed_snapshot??0);
  if(row.cashback_tracking_supported_snapshot&&row.reward_type_snapshot==='percentage_cashback'){
    cashback=rounded(order*Number(row.cashback_percent_snapshot??0)/100);
    if(row.cashback_cap_snapshot!=null)cashback=Math.min(cashback,Number(row.cashback_cap_snapshot));
  }
  cashback=rounded(Math.max(0,cashback));
  const variance=commission!=null&&expected!=null?rounded(commission-expected):null;
  const margin=commission!=null?rounded(commission-cashback):null;
  const issues:string[]=[];
  if(row.match_status!=='matched')issues.push('conversion_not_matched');
  if(row.status!=='confirmed')issues.push('provider_order_not_confirmed');
  if(!row.profile_id)issues.push('customer_not_linked');
  if(row.order_value==null)issues.push('order_value_missing');
  if(commission==null)issues.push('provider_commission_missing');
  if(expected==null)issues.push('commission_rule_missing');
  if(row.reward_type_snapshot==null)issues.push('click_reward_snapshot_missing');
  if(variance!=null&&expected!=null&&Math.abs(variance)>Math.max(1,expected*.05))issues.push('commission_variance_over_5_percent');
  if(margin!=null&&margin<0)issues.push('cashback_exceeds_commission');
  const blocking=issues.some(issue=>['conversion_not_matched','provider_order_not_confirmed','customer_not_linked','order_value_missing','provider_commission_missing','commission_rule_missing','click_reward_snapshot_missing','cashback_exceeds_commission'].includes(issue));
  return {expected,variance,cashback,margin,issues,status:blocking||issues.length?'needs_review':'ready'};
}

async function load(id:string){
  const context=await operator();
  const {data,error}=await context.supabase.from('referral_conversions').select('id,match_status,status,profile_id,order_value,commission_amount,reward_type_snapshot,cashback_fixed_snapshot,cashback_percent_snapshot,cashback_cap_snapshot,reward_funding_source_snapshot,cashback_tracking_supported_snapshot,commission_rate_snapshot,commission_fixed_snapshot').eq('id',id).single();
  if(error||!data)throw new Error('Conversion not found.');
  return {...context,row:data as FinancialConversion};
}

export async function prepareFinancialReview(formData:FormData){
  const id=String(formData.get('conversionId')??''),{supabase,user,row}=await load(id),result=calculate(row);
  const {error}=await supabase.from('referral_conversions').update({financial_validation_status:result.status,expected_commission:result.expected,commission_variance:result.variance,proposed_cashback:result.cashback,retained_margin:result.margin,financial_issue_codes:result.issues}).eq('id',id);
  if(error)throw new Error(error.message);
  await supabase.from('conversion_financial_reviews').insert({conversion_id:id,reviewer_id:user.id,decision:'prepared',provider_commission:row.commission_amount,expected_commission:result.expected,commission_variance:result.variance,proposed_cashback:result.cashback,retained_margin:result.margin,issue_codes:result.issues,note:'Calculated from the click-time reward snapshot.'});
  revalidatePath('/admin/reconciliation');
}

export async function decideFinancialReview(formData:FormData){
  const id=String(formData.get('conversionId')??''),decision=String(formData.get('decision')??''),note=String(formData.get('note')??'').trim().slice(0,500);
  if(!['approved','held','rejected'].includes(decision))throw new Error('Invalid finance decision.');
  const {supabase,user,row}=await load(id),result=calculate(row);
  if(decision==='approved'&&(result.status!=='ready'||result.issues.length))throw new Error('Resolve all blocking financial issues before approval.');
  if(decision!=='approved'&&!note)throw new Error('A review note is required for hold or rejection.');
  const {error}=await supabase.from('referral_conversions').update({financial_validation_status:decision,expected_commission:result.expected,commission_variance:result.variance,proposed_cashback:result.cashback,retained_margin:result.margin,financial_issue_codes:result.issues,cashback_amount:decision==='approved'?result.cashback:null,cashback_eligible:decision==='approved'&&result.cashback>0,financially_reviewed_at:new Date().toISOString(),financially_reviewed_by:user.id}).eq('id',id);
  if(error)throw new Error(error.message);
  await supabase.from('conversion_financial_reviews').insert({conversion_id:id,reviewer_id:user.id,decision,provider_commission:row.commission_amount,expected_commission:result.expected,commission_variance:result.variance,proposed_cashback:result.cashback,retained_margin:result.margin,issue_codes:result.issues,note:note||'Financial validation approved.'});
  await supabase.from('audit_events').insert({actor_id:user.id,event_type:`conversion_financial_${decision}`,entity_type:'referral_conversion',entity_id:id,source:'admin',metadata:{proposed_cashback:result.cashback,retained_margin:result.margin,issues:result.issues}});
  revalidatePath('/admin/reconciliation');revalidatePath('/admin/orders');
}
