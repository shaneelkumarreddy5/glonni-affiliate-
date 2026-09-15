'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(!user||assurance?.currentLevel!=='aal2'||!['owner','admin'].includes(String(user.app_metadata?.admin_role)))redirect('/admin/login');return{supabase,user};}
const slugify=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

export async function runProductDiscovery(form:FormData){
  const {supabase,user}=await requireAdmin();const query=String(form.get('query')??'').trim();const merchantId=String(form.get('merchantId')??'');if(query.length<5)redirect('/admin/products?view=ai&error=Enter+a+clear+discovery+request.');
  if(merchantId){const {data:merchant}=await supabase.from('merchants').select('id').eq('id',merchantId).maybeSingle();if(!merchant)redirect('/admin/products?view=ai&error=Select+a+valid+connected+store.');}
  const dedupeKey=createHash('sha256').update(`discovery:${query.toLowerCase()}:${merchantId}:${Math.floor(Date.now()/300000)}`).digest('hex');
  const {data:job,error}=await supabase.from('ai_jobs').insert({agent_key:'catalogue_merchandising',job_type:'product_discovery',input:{query,merchant_id:merchantId||null},created_by:user.id,dedupe_key:dedupeKey,review_only:true}).select('id').single();if(error||!job)redirect(`/admin/products?view=ai&error=${encodeURIComponent(error?.code==='23505'?'The same discovery is already running.':error?.message??'Unable to create discovery job.')}`);
  const {data,error:invokeError}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:job.id}});revalidatePath('/admin/products');revalidatePath('/admin/approvals');
  if(invokeError||data?.error)redirect(`/admin/products?view=ai&job=${job.id}&error=${encodeURIComponent(data?.error??invokeError?.message??'Discovery failed.')}`);
  redirect(`/admin/products?view=ai&job=${job.id}&success=Discovery+completed.+Review+every+candidate+before+creating+drafts.`);
}

export async function reviewDiscoveryCandidates(form:FormData){
  const {supabase,user}=await requireAdmin();const jobId=String(form.get('jobId')??'');const decision=String(form.get('decision')??'');const ids=form.getAll('candidateId').map(String).filter(Boolean);const note=String(form.get('note')??'').trim();if(!ids.length)redirect(`/admin/products?view=ai&job=${jobId}&error=Select+at+least+one+candidate.`);if(!['approve','reject','research'].includes(decision))throw new Error('Invalid candidate decision.');
  const {data:candidates}=await supabase.from('ai_discovery_candidates').select('*').eq('job_id',jobId).in('id',ids);if((candidates??[]).length!==ids.length)throw new Error('One or more candidates are unavailable.');
  for(const candidate of candidates??[]){let productDraftId=candidate.product_draft_id;if(decision==='approve'&&!productDraftId){const {data:product,error}=await supabase.from('products').insert({title:candidate.title,slug:`${slugify(candidate.title)||'discovered-product'}-${crypto.randomUUID().slice(0,8)}`,brand:candidate.brand||null,category_id:candidate.category_id||null,image_url:candidate.image_url||null,is_active:false,manual_metadata:{source:'ai_discovery',discovery_job_id:jobId,discovery_candidate_id:candidate.id,model_code:candidate.model_code,source_urls:candidate.source_urls,matched_stores:candidate.matched_stores,missing_fields:candidate.missing_fields,workflow_step:'basic'}}).select('id').single();if(error||!product)throw new Error(error?.message??'Unable to create product draft.');productDraftId=product.id;}
    const status=decision==='approve'?'approved_to_draft':decision==='reject'?'rejected':'needs_research';const now=new Date().toISOString();const {error}=await supabase.from('ai_discovery_candidates').update({status,reviewer_note:note||null,reviewed_by:user.id,reviewed_at:now,product_draft_id:productDraftId,updated_at:now}).eq('id',candidate.id).eq('job_id',jobId);if(error)throw new Error(error.message);
    await supabase.from('audit_events').insert({actor_id:user.id,event_type:`ai_discovery_candidate_${status}`,entity_type:'ai_discovery_candidate',entity_id:candidate.id,source:'admin',metadata:{job_id:jobId,product_draft_id:productDraftId}});
  }
  revalidatePath('/admin/products');revalidatePath('/admin/approvals');redirect(`/admin/products?view=ai&job=${jobId}&success=${decision==='approve'?'Selected+candidates+were+created+as+inactive+product+drafts.':'Candidate+decisions+were+recorded.'}`);
}
