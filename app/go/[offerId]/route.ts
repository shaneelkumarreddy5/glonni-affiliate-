import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest,{params}:{params:Promise<{offerId:string}>}) {
  const { offerId } = await params; const supabase = await createClient();
  const { data: offer } = await supabase.from('offers').select('destination_url').eq('id',offerId).eq('status','active').maybeSingle();
  if (!offer?.destination_url) return NextResponse.redirect(new URL('/deals',request.url));
  await supabase.rpc('record_offer_redirect',{p_offer_id:offerId,p_referrer:request.headers.get('referer'),p_user_agent:request.headers.get('user-agent')});
  return NextResponse.redirect(offer.destination_url,307);
}
