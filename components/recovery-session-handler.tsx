'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export function RecoverySessionHandler({ audience }: { audience: 'customer' | 'admin' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const redirecting = useRef(false);
  const hasRecoveryPayload = useRef<boolean | null>(null);
  if (hasRecoveryPayload.current === null && typeof window !== 'undefined') {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    hasRecoveryPayload.current = fragment.get('type') === 'recovery'
      && Boolean(fragment.get('access_token'))
      && Boolean(fragment.get('refresh_token'));
  }
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { flowType: 'implicit', detectSessionInUrl: true } },
  ), []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    if (!hasRecoveryPayload.current) {
      setError('This recovery link is invalid, already used, or expired. Request a new link and open only the newest email.');
      return;
    }

    async function continueRecovery() {
      if (!active || redirecting.current) return false;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      const isAdmin = Boolean(profile && ['owner', 'admin', 'editor'].includes(profile.role));

      if (audience === 'admin' && !isAdmin) {
        await supabase.auth.signOut();
        if (active) setError('This account is not authorized for Glonni Admin.');
        return true;
      }

      redirecting.current = true;
      router.replace(isAdmin ? '/admin/reset-password' : '/reset-password');
      router.refresh();
      return true;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void continueRecovery();
    });

    void continueRecovery().then((ready) => {
      if (!ready) timer = setTimeout(() => {
        void continueRecovery().then((found) => {
          if (!found && active) setError('This recovery link is invalid, already used, or expired. Request a new link and open only the newest email.');
        });
      }, 1800);
    });

    return () => {
      active = false;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [audience, router, supabase]);

  return error
    ? <div className="auth-notice error">{error}</div>
    : <div className="auth-notice success">Verifying your secure recovery link…</div>;
}
