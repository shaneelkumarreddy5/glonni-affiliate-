import { createClient } from '@/lib/supabase/server';

const csv=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;
export async function GET(){
  const s=await createClient();
  const {data:{user}}=await s.auth.getUser();
  if(!user)return new Response('Unauthorized',{status:401});
  const {data:profile}=await s.from('profiles').select('role').eq('id',user.id).single();
  if(!profile||!['owner','admin','editor'].includes(profile.role))return new Response('Forbidden',{status:403});
  const {data,error}=await s.from('categories').select('id,name,slug,parent_id,level,description,image_url,icon_name,seo_title,seo_description,show_on_homepage,display_order,is_active,archived_at').order('display_order');
  if(error)return new Response(error.message,{status:500});
  const names=new Map((data??[]).map(x=>[x.id,x.slug]));
  const headers=['name','slug','parent_slug','level','description','image_url','icon_name','seo_title','seo_description','show_on_homepage','display_order','is_active','archived_at'];
  const rows=(data??[]).map(x=>[x.name,x.slug,x.parent_id?names.get(x.parent_id):'',x.level,x.description,x.image_url,x.icon_name,x.seo_title,x.seo_description,x.show_on_homepage,x.display_order,x.is_active,x.archived_at].map(csv).join(','));
  return new Response([headers.join(','),...rows].join('\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="glonni-categories.csv"','cache-control':'no-store'}});
}
