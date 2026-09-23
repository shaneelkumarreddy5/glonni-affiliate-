'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowed = {
  owner_daily_brief: 'ceo_operations',
  product_enrichment: 'catalogue_merchandising',
  product_discovery: 'catalogue_merchandising',
} as const;
const enc = (value:string) => encodeURIComponent(value);

async function requireAdmin() {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!user || assurance?.currentLevel !== 'aal2' || !['owner','admin'].includes(String(user.app_metadata?.admin_role))) redirect('/admin/login');
  return { supabase, user };
}

export async function runAiJob(formData:FormData) {
  const {supabase,user}=await requireAdmin();
  const jobType=String(formData.get('jobType')??'') as keyof typeof allowed;
  const query=String(formData.get('query')??'').trim();
  if (!allowed[jobType]) redirect('/admin/ai-agents?error=Unsupported+AI+job.');
  const {data:globalSettings}=await supabase.from('platform_settings').select('work_controls').eq('id',1).maybeSingle();
  if(globalSettings?.work_controls?.pause_all===true||globalSettings?.work_controls?.ai_workflows===false)redirect('/admin/ai-agents?error=AI+workflows+are+paused+in+global+Settings.');
  if (jobType!=='owner_daily_brief' && query.length<3) redirect('/admin/ai-agents?error=Enter+a+clear+research+request.');
  const bucket=Math.floor(Date.now()/300000);
  const dedupeKey=createHash('sha256').update(`${jobType}:${query.toLowerCase()}:${bucket}`).digest('hex');
  const {data:job,error}=await supabase.from('ai_jobs').insert({agent_key:allowed[jobType],job_type:jobType,input:query?{query}:{},created_by:user.id,dedupe_key:dedupeKey,review_only:true}).select('id').single();
  if (error) redirect(`/admin/ai-agents?error=${enc(error.code==='23505'?'The same job is already queued or running.':error.message)}`);
  const {data,error:invokeError}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:job.id}});
  revalidatePath('/admin/ai-agents');
  if (invokeError || data?.error) redirect(`/admin/ai-agents?error=${enc(data?.error??invokeError?.message??'AI job failed.')}`);
  redirect('/admin/ai-agents?success=AI+job+completed+and+saved+for+review.');
}

export async function retryAiJob(formData:FormData) {
  const {supabase}=await requireAdmin(); const id=String(formData.get('jobId')??'');
  const {data,error}=await supabase.functions.invoke('ai-job-runner',{body:{job_id:id}});
  revalidatePath('/admin/ai-agents');
  if(error||data?.error) redirect(`/admin/ai-agents?error=${enc(data?.error??error?.message??'Retry failed.')}`);
  redirect('/admin/ai-agents?success=AI+job+retry+completed.');
}

export async function cancelAiJob(formData:FormData) {
  const {supabase}=await requireAdmin(); const id=String(formData.get('jobId')??''); const now=new Date().toISOString();
  const {error}=await supabase.from('ai_jobs').update({status:'cancelled',completed_at:now,updated_at:now}).eq('id',id).in('status',['queued','scheduled']);
  if(error) redirect(`/admin/ai-agents?error=${enc(error.message)}`);
  revalidatePath('/admin/ai-agents'); redirect('/admin/ai-agents?success=AI+job+cancelled.');
}
