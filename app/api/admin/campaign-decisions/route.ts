import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const offerId = String(body.offerId || ''), decision = String(body.decision || '');
  if (!offerId || !['held', 'rejected'].includes(decision)) return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (!user || assurance?.currentLevel !== 'aal2') return NextResponse.json({ error: 'An authenticated 2FA session is required.' }, { status: 403 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['owner', 'admin'].includes(profile.role)) return NextResponse.json({ error: 'Campaign decisions require admin permission.' }, { status: 403 });
  const reviewedAt = new Date().toISOString();
  const { data: pending } = await supabase.from('promotion_recommendations').select('id').eq('offer_id', offerId).eq('status', 'pending').maybeSingle();
  const result = pending
    ? await supabase.from('promotion_recommendations').update({ status: decision, reviewed_by: user.id, reviewed_at: reviewedAt, updated_at: reviewedAt }).eq('id', pending.id)
    : await supabase.from('promotion_recommendations').insert({ offer_id: offerId, status: decision, reviewed_by: user.id, reviewed_at: reviewedAt, updated_at: reviewedAt });
  const { error } = result;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
