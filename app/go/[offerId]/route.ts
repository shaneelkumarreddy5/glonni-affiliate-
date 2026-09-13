import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest,{params}:{params:Promise<{offerId:string}>}) {
  const { offerId } = await params; const supabase = await createClient();
  const [{ data: offer }, { data: { user } }] = await Promise.all([
    supabase.rpc('get_safe_offer_redirect', { p_offer_id: offerId }).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const safeOffer = offer as { destination_url: string; merchant_id: string; provider_id: string | null; click_reference_parameter:string|null } | null;
  if (!safeOffer?.destination_url || !safeOffer.merchant_id) return NextResponse.redirect(new URL('/deals?notice=This+offer+does+not+have+an+approved+merchant+destination.',request.url));
  const clickToken=crypto.randomUUID(),userAgent=request.headers.get('user-agent')??'',deviceType=/bot|crawler|spider/i.test(userAgent)?'bot':/ipad|tablet/i.test(userAgent)?'tablet':/mobile|android|iphone/i.test(userAgent)?'mobile':'desktop';
  const clean=(value:string|null)=>value?.trim().slice(0,120)||null;
  let destination:URL;
  try{destination=new URL(safeOffer.destination_url)}catch{return NextResponse.redirect(new URL('/deals?notice=This+merchant+destination+is+invalid.',request.url));}
  if(safeOffer.click_reference_parameter)destination.searchParams.set(safeOffer.click_reference_parameter,clickToken);
  const {error}=await supabase.from('redirect_events').insert({offer_id:offerId,merchant_id:safeOffer.merchant_id,provider_id:safeOffer.provider_id,profile_id:user?.id??null,click_token:clickToken,attribution_parameter:safeOffer.click_reference_parameter,attribution_value:safeOffer.click_reference_parameter?clickToken:null,traffic_source:clean(request.nextUrl.searchParams.get('utm_source')??request.nextUrl.searchParams.get('source')),traffic_medium:clean(request.nextUrl.searchParams.get('utm_medium')??request.nextUrl.searchParams.get('medium')),traffic_campaign:clean(request.nextUrl.searchParams.get('utm_campaign')??request.nextUrl.searchParams.get('campaign')),placement:clean(request.nextUrl.searchParams.get('placement')),device_type:deviceType,destination_host:destination.hostname.toLowerCase(),referrer:request.headers.get('referer'),user_agent:userAgent.slice(0,500)});
  if(error)return NextResponse.redirect(new URL('/deals?notice=Tracking+is+temporarily+unavailable.+Please+try+the+deal+again.',request.url));
  return NextResponse.redirect(destination,307);
}
