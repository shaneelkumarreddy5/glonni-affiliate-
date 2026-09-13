import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const csv=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;

export async function GET(request:NextRequest){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.redirect(new URL('/admin/login',request.url));
  const [{data:profile},{data:employee},{data:assurance}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).single(),
    supabase.from('employees').select('status').eq('profile_id',user.id).single(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if(!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active'||assurance?.currentLevel!=='aal2')return NextResponse.json({error:'Active Owner or Admin 2FA is required.'},{status:403});
  const days=[7,30,90].includes(Number(request.nextUrl.searchParams.get('days')))?Number(request.nextUrl.searchParams.get('days')):30,provider=request.nextUrl.searchParams.get('provider'),start=new Date(Date.now()-days*864e5).toISOString();
  let query=supabase.from('referral_conversions').select('provider_order_reference,provider_click_reference,status,match_status,financial_validation_status,order_value,commission_amount,proposed_cashback,retained_margin,currency,created_at,affiliate_providers(name),merchants(name),profiles(display_name)').gte('created_at',start).order('created_at',{ascending:false}).limit(10000);
  if(provider)query=query.eq('provider_id',provider);
  const {data,error}=await query;if(error)return NextResponse.json({error:error.message},{status:500});
  const headings=['Created','Provider','Merchant','Order reference','Click reference','Customer','Order status','Match status','Financial status','Order value','Commission','Customer cashback','Glonni margin','Currency'];
  const lines=[headings.map(csv).join(','),...(data??[]).map(row=>{const providerRow=row.affiliate_providers as unknown as {name?:string}|null,merchant=row.merchants as unknown as {name?:string}|null,customer=row.profiles as unknown as {display_name?:string}|null;return[row.created_at,providerRow?.name,merchant?.name,row.provider_order_reference,row.provider_click_reference,customer?.display_name,row.status,row.match_status,row.financial_validation_status,row.order_value,row.commission_amount,row.proposed_cashback,row.retained_margin,row.currency].map(csv).join(',')})];
  return new NextResponse(lines.join('\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="glonni-affiliate-operations-${new Date().toISOString().slice(0,10)}.csv"`,'cache-control':'private, no-store'}});
}
