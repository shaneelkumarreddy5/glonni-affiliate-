import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith('/account') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const path = request.nextUrl.pathname;
  const publicAdminPath = path === '/admin/login' || path === '/admin/onboarding' || path.startsWith('/admin/mfa/') || path === '/admin/forgot-password' || path === '/admin/owner-setup' || path === '/admin/accept-invitation' || path === '/admin/reset-password';
  const adminSessionPath = path === '/admin/onboarding' || path.startsWith('/admin/mfa/') || path === '/admin/reset-password';
  if (adminSessionPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('error', 'Sign in or open your latest secure invitation link first.');
    return NextResponse.redirect(url);
  }
  if (path.startsWith('/admin') && !publicAdminPath) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
    const [{ data: profile }, { data: employee }, { data: assurance }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('employees').select('status, requires_mfa').eq('profile_id', user.id).single(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (!profile || !['owner', 'admin', 'editor'].includes(profile.role) || !employee || !['active', 'invited'].includes(employee.status)) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('error', 'This account does not have active admin access.');
      return NextResponse.redirect(url);
    }
    if (employee.requires_mfa && assurance?.currentLevel !== 'aal2') {
      const url = request.nextUrl.clone();
      url.pathname = assurance?.nextLevel === 'aal2' ? '/admin/mfa/challenge' : '/admin/mfa/enroll';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
  }
  return response;
}
