import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest,{params}:{params:Promise<{offerId:string}>}) {
  const { offerId } = await params; const supabase = await createClient();
  const [{ data: offer }, { data: { user } }] = await Promise.all([
    supabase.rpc('get_safe_offer_redirect', { p_offer_id: offerId }).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const safeOffer = offer as { destination_url:string;merchant_id:string;provider_id:string|null;click_reference_parameter:string|null;reward_type:string|null;cashback_amount:number|null;cashback_percent:number|null;cashback_cap:number|null;reward_funding_source:string|null;cashback_tracking_supported:boolean|null;commission_rate:number|null;commission_amount:number|null;reward_terms:string|null;cashback_confirmation_days:number|null } | null;
  if (!safeOffer?.destination_url || !safeOffer.merchant_id) return NextResponse.redirect(new URL('/deals?notice=This+offer+does+not+have+an+approved+merchant+destination.',request.url));
  const clickToken=crypto.randomUUID(),userAgent=request.headers.get('user-agent')??'',deviceType=/bot|crawler|spider/i.test(userAgent)?'bot':/ipad|tablet/i.test(userAgent)?'tablet':/mobile|android|iphone/i.test(userAgent)?'mobile':'desktop';
  const clean=(value:string|null)=>value?.trim().slice(0,120)||null;
  let destination:URL;
  try{destination=new URL(safeOffer.destination_url)}catch{return NextResponse.redirect(new URL('/deals?notice=This+merchant+destination+is+invalid.',request.url));}
  if(safeOffer.click_reference_parameter)destination.searchParams.set(safeOffer.click_reference_parameter,clickToken);
  const {error}=await supabase.from('redirect_events').insert({offer_id:offerId,merchant_id:safeOffer.merchant_id,provider_id:safeOffer.provider_id,profile_id:user?.id??null,click_token:clickToken,attribution_parameter:safeOffer.click_reference_parameter,attribution_value:safeOffer.click_reference_parameter?clickToken:null,reward_type_snapshot:safeOffer.reward_type,cashback_fixed_snapshot:safeOffer.cashback_amount,cashback_percent_snapshot:safeOffer.cashback_percent,cashback_cap_snapshot:safeOffer.cashback_cap,reward_funding_source_snapshot:safeOffer.reward_funding_source,cashback_tracking_supported_snapshot:safeOffer.cashback_tracking_supported,commission_rate_snapshot:safeOffer.commission_rate,commission_fixed_snapshot:safeOffer.commission_amount,reward_terms_snapshot:safeOffer.reward_terms,cashback_confirmation_days_snapshot:safeOffer.cashback_confirmation_days,traffic_source:clean(request.nextUrl.searchParams.get('utm_source')??request.nextUrl.searchParams.get('source')),traffic_medium:clean(request.nextUrl.searchParams.get('utm_medium')??request.nextUrl.searchParams.get('medium')),traffic_campaign:clean(request.nextUrl.searchParams.get('utm_campaign')??request.nextUrl.searchParams.get('campaign')),placement:clean(request.nextUrl.searchParams.get('placement')),device_type:deviceType,destination_host:destination.hostname.toLowerCase(),referrer:request.headers.get('referer'),user_agent:userAgent.slice(0,500)});
  if(error)return NextResponse.redirect(new URL('/deals?notice=Tracking+is+temporarily+unavailable.+Please+try+the+deal+again.',request.url));
  return NextResponse.redirect(destination,307);
}
