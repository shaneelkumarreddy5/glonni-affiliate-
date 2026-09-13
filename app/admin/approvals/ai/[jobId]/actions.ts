'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireReviewer() {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(!user||assurance?.currentLevel!=='aal2'||!['owner','admin'].includes(String(user.app_metadata?.admin_role))) redirect('/admin/login');
  return {supabase,user};
}
const parse=(value:string)=>{try{return JSON.parse(value)}catch{return value}};
const slugify=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

export async function reviewAiField(form:FormData){
  const {supabase,user}=await requireReviewer(); const jobId=String(form.get('jobId')??''); const fieldKey=String(form.get('fieldKey')??''); const decision=String(form.get('decision')??''); const edited=String(form.get('approvedValue')??'').trim();
  if(!['accepted','rejected','edited'].includes(decision)) throw new Error('Choose a valid field decision.');
  const {data:job}=await supabase.from('ai_jobs').select('output,status').eq('id',jobId).single(); const proposal=job?.output?.proposal??job?.output??{};
  if(job?.status!=='completed'||!Object.prototype.hasOwnProperty.call(proposal,fieldKey)||['model','review_only'].includes(fieldKey)) throw new Error('This AI field is not available for review.');
  const original=proposal[fieldKey];
  const approvedValue=decision==='rejected'?null:decision==='edited'?parse(edited):original;
  const {error}=await supabase.from('ai_job_field_reviews').upsert({job_id:jobId,field_key:fieldKey,decision,original_value:original,approved_value:approvedValue,note:String(form.get('note')??'').trim()||null,reviewed_by:user.id,reviewed_at:new Date().toISOString()},{onConflict:'job_id,field_key'});
  if(error) throw new Error(error.message);
  await supabase.from('ai_jobs').update({review_status:'in_review',updated_at:new Date().toISOString()}).eq('id',jobId);
  await supabase.from('ai_job_events').insert({job_id:jobId,event_type:`field_${decision}`,actor_id:user.id,detail:{field_key:fieldKey}});
  revalidatePath(`/admin/approvals/ai/${jobId}`); revalidatePath('/admin/approvals');
}

export async function decideAiJob(form:FormData){
  const {supabase,user}=await requireReviewer(); const jobId=String(form.get('jobId')??''); const decision=String(form.get('decision')??''); const note=String(form.get('note')??'').trim();
  if(!['approved','rejected','changes_requested','on_hold'].includes(decision)) throw new Error('Choose a valid review decision.');
  const {data:job}=await supabase.from('ai_jobs').select('*').eq('id',jobId).single(); if(!job||job.status!=='completed') throw new Error('Only completed jobs can be reviewed.');
  let productDraftId=job.product_draft_id;
  if(decision==='approved'&&job.job_type==='product_enrichment'&&!productDraftId){
    const {data:reviews}=await supabase.from('ai_job_field_reviews').select('field_key,decision,approved_value').eq('job_id',jobId);
    const selected=Object.fromEntries((reviews??[]).filter(row=>row.decision!=='rejected').map(row=>[row.field_key,row.approved_value])); const proposal=job.output?.proposal??job.output??{}; const value=(key:string)=>key in selected?selected[key]:proposal[key]; const title=String(value('title')??job.input?.query??'AI product draft').trim();
    const requestedCategory=String(value('category_id')??''); const {data:category}=requestedCategory?await supabase.from('categories').select('id').eq('id',requestedCategory).eq('is_active',true).maybeSingle():{data:null};
    const {data:product,error}=await supabase.from('products').insert({title,slug:`${slugify(title)||'ai-product'}-${crypto.randomUUID().slice(0,8)}`,brand:value('brand')||null,description:value('description')||null,category_id:category?.id??null,image_url:value('primary_image_url')||null,gallery_images:Array.isArray(value('gallery_images'))?value('gallery_images'):[],variants:Array.isArray(value('variations'))?value('variations'):[],specifications:Array.isArray(value('specifications'))?value('specifications'):[],product_information:value('product_information')&&typeof value('product_information')==='object'?value('product_information'):{},is_active:false,manual_metadata:{source:'ai_job_review',ai_job_id:jobId,workflow_step:'basic'}}).select('id').single();
    if(error||!product) throw new Error(error?.message??'Unable to create product draft.'); productDraftId=product.id;
  }
  const now=new Date().toISOString(); const {error}=await supabase.from('ai_jobs').update({review_status:decision,reviewed_by:user.id,reviewed_at:now,review_note:note||null,product_draft_id:productDraftId,updated_at:now}).eq('id',jobId); if(error) throw new Error(error.message);
  await Promise.all([supabase.from('ai_job_events').insert({job_id:jobId,event_type:`review_${decision}`,actor_id:user.id,detail:{note,product_draft_id:productDraftId}}),supabase.from('audit_events').insert({actor_id:user.id,event_type:`ai_job_${decision}`,entity_type:'ai_job',entity_id:jobId,source:'admin',metadata:{job_type:job.job_type,product_draft_id:productDraftId}})]);
  if(decision==='changes_requested'){
    const {data:replacement,error:replacementError}=await supabase.from('ai_jobs').insert({agent_key:job.agent_key,job_type:job.job_type,input:{...(job.input??{}),reviewer_instruction:note||'Research again and correct incomplete or unsupported information.'},created_by:user.id,dedupe_key:`review-retry:${jobId}:${crypto.randomUUID()}`,review_only:true,retry_of_job_id:jobId}).select('id').single();
    if(replacementError||!replacement) throw new Error(replacementError?.message??'Unable to queue the revised research.');
    await supabase.from('ai_job_events').insert({job_id:jobId,event_type:'replacement_queued',actor_id:user.id,detail:{replacement_job_id:replacement.id}});
    const {data,error:invokeError}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:replacement.id}}); revalidatePath('/admin/ai-agents'); revalidatePath('/admin/approvals');
    if(invokeError||data?.error) redirect(`/admin/ai-agents?error=${encodeURIComponent(data?.error??invokeError?.message??'Revised AI job failed.')}`);
    redirect(`/admin/approvals/ai/${replacement.id}?success=Revised+AI+result+is+ready+for+review.`);
  }
  revalidatePath('/admin/approvals'); revalidatePath('/admin/ai-agents'); revalidatePath('/admin/products');
  if(productDraftId) redirect(`/admin/products?view=manual&draft=${productDraftId}&step=basic&success=AI+review+approved.+Complete+the+draft+before+publishing.`);
  redirect(`/admin/approvals/ai/${jobId}?success=Decision+recorded.`);
}
