import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fresh = () => crypto.randomUUID();

export async function updateSession(request: NextRequest) {
  const started = Date.now();
  const sessionId = uuid.test(request.cookies.get('glonni_session_id')?.value ?? '') ? request.cookies.get('glonni_session_id')!.value : fresh();
  const deviceId = uuid.test(request.cookies.get('glonni_device_id')?.value ?? '') ? request.cookies.get('glonni_device_id')!.value : fresh();
  const requestId = fresh();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const record = async (target: NextResponse, surface: 'customer' | 'admin' | 'api' | 'web', status?: number, error?: string) => {
    target.cookies.set('glonni_session_id', sessionId, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7 });
    target.cookies.set('glonni_device_id', deviceId, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
    target.headers.set('x-glonni-request-id', requestId);
    await supabase.from('activity_events').insert({ actor_id: user?.id ?? null, request_id: requestId, session_id: sessionId, device_id: deviceId, surface, event_type: 'http_request', endpoint: path, http_method: request.method, request_status: status ?? target.status ?? 200, response_time_ms: Date.now() - started, ip_address: request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null, user_agent: request.headers.get('user-agent'), error_details: error ?? null, metadata: { query_keys: [...request.nextUrl.searchParams.keys()].slice(0, 20) } });
    return target;
  };
  const surface = path.startsWith('/admin') ? 'admin' : path.startsWith('/api') ? 'api' : path.startsWith('/functions') ? 'api' : 'customer';
  if ((path.startsWith('/account') || path.startsWith('/cashback-claim') || path.startsWith('/wallet')) && !user) { const url = request.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('next', path); return record(NextResponse.redirect(url), 'customer', 307, 'authentication_required'); }
  const publicAdminPath = path === '/admin/login' || path === '/admin/onboarding' || path.startsWith('/admin/mfa/') || path === '/admin/forgot-password' || path === '/admin/owner-setup' || path === '/admin/accept-invitation' || path === '/admin/reset-password';
  const adminSessionPath = path === '/admin/onboarding' || path.startsWith('/admin/mfa/') || path === '/admin/reset-password';
  if (adminSessionPath && !user) { const url = request.nextUrl.clone(); url.pathname = '/admin/login'; url.searchParams.set('error', 'Sign in or open your latest secure invitation link first.'); return record(NextResponse.redirect(url), 'admin', 307, 'authentication_required'); }
  if (path.startsWith('/admin') && !publicAdminPath) {
    if (!user) { const url = request.nextUrl.clone(); url.pathname = '/admin/login'; url.searchParams.set('next', path); return record(NextResponse.redirect(url), 'admin', 307, 'authentication_required'); }
    const [{ data: profile }, { data: employee }, { data: assurance }] = await Promise.all([supabase.from('profiles').select('role').eq('id', user.id).single(), supabase.from('employees').select('status, requires_mfa').eq('profile_id', user.id).single(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (!profile || !['owner', 'admin', 'editor'].includes(profile.role) || !employee || !['active', 'invited'].includes(employee.status)) { await supabase.auth.signOut(); const url = request.nextUrl.clone(); url.pathname = '/admin/login'; url.searchParams.set('error', 'This account does not have active admin access.'); return record(NextResponse.redirect(url), 'admin', 307, 'admin_access_denied'); }
    if (employee.requires_mfa && assurance?.currentLevel !== 'aal2') { const url = request.nextUrl.clone(); url.pathname = assurance?.nextLevel === 'aal2' ? '/admin/mfa/challenge' : '/admin/mfa/enroll'; url.searchParams.set('next', path); return record(NextResponse.redirect(url), 'admin', 307, 'mfa_required'); }
  }
  return record(response, surface);
}
