import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest,{params}:{params:Promise<{offerId:string}>}) {
  const { offerId } = await params; const supabase = await createClient();
  const [{ data: offer }, { data: { user } }] = await Promise.all([
    supabase.rpc('get_safe_offer_redirect', { p_offer_id: offerId }).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const safeOffer = offer as { destination_url: string; merchant_id: string; provider_id: string | null } | null;
  if (!safeOffer?.destination_url || !safeOffer.merchant_id) return NextResponse.redirect(new URL('/deals?notice=This+offer+does+not+have+an+approved+merchant+destination.',request.url));
  await supabase.from('redirect_events').insert({offer_id:offerId,merchant_id:safeOffer.merchant_id,provider_id:safeOffer.provider_id,profile_id:user?.id??null,referrer:request.headers.get('referer'),user_agent:request.headers.get('user-agent')});
  return NextResponse.redirect(safeOffer.destination_url,307);
}
