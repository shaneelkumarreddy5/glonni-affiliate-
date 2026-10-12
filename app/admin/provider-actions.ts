'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cuelinksDisplayLink } from '@/lib/cuelinks-display';

export async function registerCuelinksProvider(){
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login');
  const [{data:profile},{data:employee}]=await Promise.all([supabase.from('profiles').select('role').eq('id',user.id).single(),supabase.from('employees').select('status').eq('profile_id',user.id).single()]);
  if(!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active'||assurance?.currentLevel!=='aal2')throw new Error('An active Owner or Admin with 2FA is required.');
  const {data:existing,error:lookupError}=await supabase.from('affiliate_providers').select('id').eq('adapter_key','cuelinks').maybeSingle();
  if(lookupError)throw new Error(lookupError.message);
  if(existing)redirect('/admin/providers?success=Cuelinks%20is%20already%20registered');
  let attributionVerified=false;
  try{
    const probe=`glonni-check-${crypto.randomUUID()}`;
    const {data,error}=await supabase.functions.invoke('cuelinks',{body:{action:'convert_link',url:'https://www.flipkart.com/',subid:probe}});
    const link=!error&&data?.provider==='cuelinks'&&data?.action==='convert_link'?cuelinksDisplayLink(data.data):null;
    if(link){
      const tracking=new URL(link.trackingUrl);
      const destination=tracking.searchParams.get('url');
      attributionVerified=tracking.searchParams.get('subid')===probe||(()=>{try{return destination?new URL(destination).searchParams.get('subid')===probe:false;}catch{return false;}})();
    }
  }catch{attributionVerified=false;}
  const {data:provider,error}=await supabase.from('affiliate_providers').insert({
    name:'Cuelinks',
    adapter_key:'cuelinks',
    integration_mode:'approval_required',
    config:{api_version:3,api_base_url:'https://developers.cuelinks.com/pub_api/v3',country_id:252,currency:'INR'},
    is_active:true,
    click_reference_parameter:attributionVerified?'subid':null,
    attribution_enabled:attributionVerified,
    attribution_verified_at:attributionVerified?new Date().toISOString():null,
    attribution_verified_by:attributionVerified?user.id:null,
  }).select('id').single();
  if(error||!provider)throw new Error(error?.message||'Cuelinks provider could not be registered.');
  await supabase.from('audit_events').insert({actor_id:user.id,event_type:'affiliate_provider_registered',entity_type:'affiliate_provider',entity_id:provider.id,source:'admin',metadata:{adapter_key:'cuelinks',api_version:3,click_reference_parameter:attributionVerified?'subid':null,attribution_verified:attributionVerified}});
  revalidatePath('/admin/providers');
  revalidatePath('/admin/integrations');
  redirect(attributionVerified?'/admin/providers?success=Cuelinks%20registered.%20Click-ID%20tracking%20was%20verified.':'/admin/providers?success=Cuelinks%20registered.%20Link%20tracking%20needs%20a%20scope%20or%20channel%20check%20before%20attribution%20can%20be%20enabled.');
}

export async function saveProviderAttribution(formData:FormData){
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login');
  const [{data:profile},{data:employee}]=await Promise.all([supabase.from('profiles').select('role').eq('id',user.id).single(),supabase.from('employees').select('status').eq('profile_id',user.id).single()]);
  if(!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active'||assurance?.currentLevel!=='aal2')throw new Error('An active Owner or Admin with 2FA is required.');
  const providerId=String(formData.get('providerId')??''),parameter=String(formData.get('parameter')??'').trim(),enabled=formData.get('enabled')==='on';
  if(!providerId)throw new Error('Provider is required.');
  if(enabled&&!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(parameter))throw new Error('Enter the exact provider-approved click reference parameter.');
  const {error}=await supabase.from('affiliate_providers').update({click_reference_parameter:parameter||null,attribution_enabled:enabled,attribution_verified_at:enabled?new Date().toISOString():null,attribution_verified_by:enabled?user.id:null}).eq('id',providerId);
  if(error)throw new Error(error.message);
  await supabase.from('audit_events').insert({actor_id:user.id,event_type:'provider_attribution_updated',entity_type:'affiliate_provider',entity_id:providerId,source:'admin',metadata:{parameter:parameter||null,enabled}});
  revalidatePath('/admin/providers');
  redirect('/admin/providers?success=Attribution%20configuration%20saved');
}
