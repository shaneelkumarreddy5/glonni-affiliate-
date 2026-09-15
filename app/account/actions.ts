'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
const message=(value:string)=>encodeURIComponent(value);
async function currentUser(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login?next=/account');return{supabase,user};}

export async function updateProfile(formData:FormData){
  const{supabase,user}=await currentUser();
  const firstName=String(formData.get('firstName')??'').trim(),lastName=String(formData.get('lastName')??'').trim(),city=String(formData.get('city')??'').trim(),state=String(formData.get('state')??'').trim(),addressLine1=String(formData.get('addressLine1')??'').trim(),addressLine2=String(formData.get('addressLine2')??'').trim(),postalCode=String(formData.get('postalCode')??'').trim(),avatar=formData.get('avatar');
  const displayName=`${firstName} ${lastName}`.trim(),hasAddress=Boolean(addressLine1||city||state||postalCode);
  const invalidName=firstName.length<2||firstName.length>50||lastName.length>50;
  const invalidAddress=hasAddress&&(addressLine1.length<5||city.length<2||state.length<2||!/^[0-9]{6}$/.test(postalCode));
  if(invalidName||invalidAddress||addressLine2.length>160)redirect(`/account?section=profile&error=${message(hasAddress?'Complete every address field and enter a valid 6-digit PIN code, or leave the optional address blank.':'Enter a valid first name. Your last name is optional.')}`);
  let avatarUrl:string|undefined;
  if(avatar instanceof File&&avatar.size>0){const allowed:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};const extension=allowed[avatar.type];if(!extension||avatar.size>2*1024*1024)redirect(`/account?section=profile&error=${message('Use a JPG, PNG or WebP image smaller than 2 MB.')}`);const path=`${user.id}/avatar.${extension}`;const{error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,avatar,{upsert:true,contentType:avatar.type,cacheControl:'3600'});if(uploadError)redirect(`/account?section=profile&error=${message('We could not upload your profile photo. Please try again.')}`);const{data:publicUrl}=supabase.storage.from('profile-avatars').getPublicUrl(path);avatarUrl=`${publicUrl.publicUrl}?v=${Date.now()}`;}
  const{error}=await supabase.from('profiles').update({display_name:displayName,city:city||null,state:state||null,...(avatarUrl?{avatar_url:avatarUrl}:{})}).eq('id',user.id);if(error)redirect(`/account?section=profile&error=${message('We could not update your profile. Please try again.')}`);
  const{error:metadataError}=await supabase.auth.updateUser({data:{...user.user_metadata,first_name:firstName,last_name:lastName,address_line1:addressLine1,address_line2:addressLine2,postal_code:postalCode}});if(metadataError)redirect(`/account?section=profile&error=${message('Your basic profile was saved, but address details could not be saved. Please try again.')}`);
  revalidatePath('/','layout');revalidatePath('/account');redirect(`/account?section=profile&success=${message('Your profile has been updated.')}`);
}

export async function updatePreferences(formData:FormData){
  const{supabase,user}=await currentUser();const[{data:categoryRows},{data:storeRows}]=await Promise.all([supabase.from('categories').select('name').eq('is_active',true).is('parent_id',null),supabase.from('merchants').select('name').eq('is_active',true)]);const categories=(categoryRows??[]).map(row=>row.name),stores=(storeRows??[]).map(row=>row.name);const chosenCategories=formData.getAll('categories').map(String).filter(value=>categories.includes(value)),chosenStores=formData.getAll('stores').map(String).filter(value=>stores.includes(value));const{error}=await supabase.from('customer_preferences').upsert({profile_id:user.id,favourite_categories:chosenCategories,favourite_stores:chosenStores,price_drop_alerts:formData.get('priceDropAlerts')==='on',deal_expiry_alerts:formData.get('dealExpiryAlerts')==='on',marketing_updates:formData.get('marketingUpdates')==='on',email_deal_updates:formData.get('emailDealUpdates')==='on',whatsapp_deal_updates:formData.get('whatsappDealUpdates')==='on',sms_deal_updates:formData.get('smsDealUpdates')==='on',updated_at:new Date().toISOString()});if(error)redirect(`/account?section=preferences&error=${message('We could not save your preferences. Please try again.')}`);revalidatePath('/account');redirect(`/account?section=preferences&success=${message('Your shopping preferences have been saved.')}`);
}

export async function changePassword(formData:FormData){
  const{supabase}=await currentUser();const password=String(formData.get('password')??''),confirmation=String(formData.get('passwordConfirmation')??'');if(password.length<8)redirect(`/account?section=security&error=${message('Use a password with at least 8 characters.')}`);if(password!==confirmation)redirect(`/account?section=security&error=${message('The two passwords do not match.')}`);const{error}=await supabase.auth.updateUser({password});if(error)redirect(`/account?section=security&error=${message('We could not change your password. Please sign in again and retry.')}`);redirect(`/account?section=security&success=${message('Your password has been changed securely.')}`);
}
