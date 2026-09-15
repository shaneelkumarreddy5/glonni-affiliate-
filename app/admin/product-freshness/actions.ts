'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedSections=new Set(['identity','images','taxonomy','variants','specifications','information','store_offers']);
const enc=(value:string)=>encodeURIComponent(value);
async function requireAdmin(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(!user||assurance?.currentLevel!=='aal2'||!['owner','admin'].includes(String(user.app_metadata?.admin_role)))redirect('/admin/login');return{supabase,user};}
const sections=(form:FormData)=>form.getAll('sections').map(String).filter(value=>allowedSections.has(value));

export async function saveRefreshPolicy(form:FormData){
  const {supabase,user}=await requireAdmin();const productId=String(form.get('productId')??'');const selected=sections(form);const frequency=Math.max(1,Math.min(720,Number(form.get('frequencyHours'))||24));const stale=Math.max(1,Math.min(2160,Number(form.get('staleHours'))||24));
  if(!productId||!selected.length)redirect('/admin/product-freshness?error=Choose+a+product+and+at+least+one+refresh+section.');
  const {data:product}=await supabase.from('products').select('id').eq('id',productId).maybeSingle();if(!product)redirect('/admin/product-freshness?error=The+selected+product+does+not+exist.');
  const now=new Date().toISOString();const {error}=await supabase.from('product_refresh_policies').upsert({product_id:productId,is_enabled:true,frequency_hours:frequency,stale_after_hours:stale,sections:selected,requires_review:true,next_run_at:now,created_by:user.id,updated_by:user.id,updated_at:now},{onConflict:'product_id'});
  if(error)redirect(`/admin/product-freshness?error=${enc(error.message)}`);await supabase.from('audit_events').insert({actor_id:user.id,event_type:'product_refresh_policy_saved',entity_type:'product',entity_id:productId,source:'admin',metadata:{frequency_hours:frequency,stale_after_hours:stale,sections:selected}});revalidatePath('/admin/product-freshness');redirect('/admin/product-freshness?success=Refresh+policy+saved.');
}

export async function toggleRefreshPolicy(form:FormData){const {supabase,user}=await requireAdmin();const policyId=String(form.get('policyId')??'');const enabled=String(form.get('enabled'))==='true';const {error}=await supabase.from('product_refresh_policies').update({is_enabled:enabled,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',policyId);if(error)throw new Error(error.message);revalidatePath('/admin/product-freshness');}

export async function runProductRefresh(form:FormData){
  const {supabase,user}=await requireAdmin();const productId=String(form.get('productId')??'');const policyId=String(form.get('policyId')??'')||null;const selected=sections(form);const {data:product}=await supabase.from('products').select('id,title').eq('id',productId).single();if(!product)throw new Error('Product not found.');
  const {data:run,error:runError}=await supabase.from('product_refresh_runs').insert({policy_id:policyId,product_id:productId,trigger_type:'manual',status:'queued',sections:selected,created_by:user.id}).select('id').single();if(runError||!run)throw new Error(runError?.message??'Unable to create refresh run.');
  const {data:job,error:jobError}=await supabase.from('ai_jobs').insert({agent_key:'catalogue_merchandising',job_type:'product_enrichment',input:{query:product.title,quality_test:true,scheduled_refresh:true,refresh_run_id:run.id,source_product_id:product.id,sections:selected},created_by:user.id,dedupe_key:`refresh:${product.id}:${Date.now()}`,review_only:true}).select('id').single();if(jobError||!job){await supabase.from('product_refresh_runs').update({status:'failed',error_message:jobError?.message??'Unable to create AI job',completed_at:new Date().toISOString()}).eq('id',run.id);throw new Error(jobError?.message??'Unable to create AI job.');}
  const started=new Date().toISOString();await supabase.from('product_refresh_runs').update({ai_job_id:job.id,status:'running',started_at:started,updated_at:started}).eq('id',run.id);const {data,error}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:job.id}});const finished=new Date().toISOString();
  if(error||data?.error){await supabase.from('product_refresh_runs').update({status:'failed',error_message:data?.error??error?.message??'Refresh failed',completed_at:finished,updated_at:finished}).eq('id',run.id);if(policyId)await supabase.from('product_refresh_policies').update({last_run_at:finished,consecutive_failures:1,updated_by:user.id,updated_at:finished}).eq('id',policyId);redirect(`/admin/product-freshness?error=${enc(data?.error??error?.message??'Refresh failed.')}`);}
  await supabase.from('product_refresh_runs').update({status:'review_required',summary:'AI refresh completed. Compare and approve changes before publishing.',completed_at:finished,updated_at:finished}).eq('id',run.id);if(policyId){const {data:policy}=await supabase.from('product_refresh_policies').select('frequency_hours').eq('id',policyId).single();await supabase.from('product_refresh_policies').update({last_run_at:finished,last_success_at:finished,consecutive_failures:0,next_run_at:new Date(Date.now()+Number(policy?.frequency_hours??24)*3600000).toISOString(),updated_by:user.id,updated_at:finished}).eq('id',policyId);}
  revalidatePath('/admin/product-freshness');revalidatePath('/admin/approvals');redirect(`/admin/ai-quality?job=${job.id}&success=Refresh+completed.+Review+every+change+before+approval.`);
}
