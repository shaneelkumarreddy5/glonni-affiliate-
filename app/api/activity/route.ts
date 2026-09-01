import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body = await request.json().catch(() => ({})) as { eventType?: string; label?: string; path?: string; sessionId?: string; deviceId?: string };
  const validType = body.eventType === 'ui_click' || body.eventType === 'ui_submit';
  if (!validType) return NextResponse.json({ error: 'Unsupported activity event' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('activity_events').insert({
    actor_id: user?.id ?? null, surface: body.path?.startsWith('/admin') ? 'admin' : 'customer', event_type: body.eventType,
    endpoint: body.path?.startsWith('/') ? body.path.slice(0, 500) : '/', http_method: 'POST', request_status: 202,
    response_time_ms: Date.now() - started, session_id: id.test(body.sessionId ?? '') ? body.sessionId : null,
    device_id: id.test(body.deviceId ?? '') ? body.deviceId : null, user_agent: request.headers.get('user-agent'),
    ip_address: request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    metadata: { label: String(body.label ?? '').slice(0, 80) },
  });
  if (error) return NextResponse.json({ error: 'Activity could not be recorded' }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 202 });
}
