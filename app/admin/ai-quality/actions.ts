'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedSections = new Set(['all','identity','images','taxonomy','variants','specifications','information','store_offers']);
const enc=(value:string)=>encodeURIComponent(value);

async function requireAdmin(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(!user||assurance?.currentLevel!=='aal2'||!['owner','admin'].includes(String(user.app_metadata?.admin_role)))redirect('/admin/login');
  return {supabase,user};
}

export async function runQualityTest(formData:FormData){
  const {supabase,user}=await requireAdmin();
  const productId=String(formData.get('productId')??'').trim();
  const manualQuery=String(formData.get('query')??'').trim();
  const section=String(formData.get('section')??'all');
  if(!allowedSections.has(section))redirect('/admin/ai-quality?error=Choose+a+valid+test+section.');
  const {data:product}=productId?await supabase.from('products').select('id,title').eq('id',productId).maybeSingle():{data:null};
  const query=manualQuery||product?.title||'';
  if(query.length<3)redirect('/admin/ai-quality?error=Choose+a+saved+product+or+enter+a+product+name.');
  const bucket=Math.floor(Date.now()/300000);
  const dedupeKey=createHash('sha256').update(`quality:${productId}:${query.toLowerCase()}:${section}:${bucket}`).digest('hex');
  const input={query,quality_test:true,source_product_id:product?.id??null,sections:section==='all'?[]:[section]};
  const {data:job,error}=await supabase.from('ai_jobs').insert({agent_key:'catalogue_merchandising',job_type:'product_enrichment',input,created_by:user.id,dedupe_key:dedupeKey,review_only:true}).select('id').single();
  if(error||!job)redirect(`/admin/ai-quality?error=${enc(error?.code==='23505'?'The same quality test is already running.':error?.message??'Unable to create the quality test.')}`);
  const {data,error:invokeError}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:job.id}});
  revalidatePath('/admin/ai-quality');
  if(invokeError||data?.error)redirect(`/admin/ai-quality?error=${enc(data?.error??invokeError?.message??'The AI quality test failed.')}`);
  redirect(`/admin/ai-quality?job=${job.id}&success=Quality+test+completed.+Review+the+comparison+below.`);
}

export async function rerunQualitySection(formData:FormData){
  const {supabase,user}=await requireAdmin();
  const sourceJobId=String(formData.get('jobId')??'');
  const section=String(formData.get('section')??'all');
  if(!allowedSections.has(section)||section==='all')throw new Error('Choose a valid section to rerun.');
  const {data:source}=await supabase.from('ai_jobs').select('input').eq('id',sourceJobId).eq('job_type','product_enrichment').single();
  if(!source)throw new Error('The original quality test was not found.');
  const input={...(source.input??{}),quality_test:true,sections:[section],reviewer_instruction:`Recheck only the ${section.replaceAll('_',' ')} section. Correct missing or conflicting information and cite reliable current sources.`};
  const {data:job,error}=await supabase.from('ai_jobs').insert({agent_key:'catalogue_merchandising',job_type:'product_enrichment',input,created_by:user.id,dedupe_key:`quality-rerun:${sourceJobId}:${section}:${crypto.randomUUID()}`,review_only:true,retry_of_job_id:sourceJobId}).select('id').single();
  if(error||!job)throw new Error(error?.message??'Unable to create the section rerun.');
  const {data,error:invokeError}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:job.id}});
  revalidatePath('/admin/ai-quality');
  if(invokeError||data?.error)redirect(`/admin/ai-quality?error=${enc(data?.error??invokeError?.message??'The section rerun failed.')}`);
  redirect(`/admin/ai-quality?job=${job.id}&success=${enc(`${section.replaceAll('_',' ')} was fetched again.`)}`);
}
