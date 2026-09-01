'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function OwnerSetupForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setToken(fragment.get('token') ?? '');
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!token) return setError('This private setup link is missing or invalid.');
    if (password !== confirmation) return setError('The two passwords do not match.');
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return setError('Use at least 12 characters with uppercase, lowercase, a number and a symbol.');
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: invokeError } = await supabase.functions.invoke('admin-invite-user', {
      body: { mode: 'owner_setup', token, password },
    });
    if (invokeError || data?.error) {
      setError(data?.error ?? 'The password could not be saved. Request a new private setup link.');
      setLoading(false);
      return;
    }
    router.replace('/admin/login?success=Owner+password+created.+Sign+in+to+set+up+Google+Authenticator.');
    router.refresh();
  }

  return <form onSubmit={submit} className="auth-form"><label>Create Owner password<input type="password" value={password} onChange={(event)=>setPassword(event.target.value)} minLength={12} autoComplete="new-password" required placeholder="12+ characters"/></label><label>Confirm password<input type="password" value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} minLength={12} autoComplete="new-password" required/></label>{error&&<div className="auth-notice error">{error}</div>}<button type="submit" disabled={loading||!token}>{loading?'Saving securely…':'Create Owner password'}</button></form>;
}
