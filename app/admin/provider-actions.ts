'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
