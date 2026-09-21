'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function AiProviderHealthButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function check() {
    setLoading(true);
    setMessage('Checking…');
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('ai-provider-health', { body: {} });
    if (error || data?.status === 'invalid') {
      setMessage(data?.status === 'invalid' ? 'JEV connection failed' : 'Check could not complete');
      setLoading(false);
      return;
    }
    setMessage(data?.status === 'connected' ? 'JEV connected' : 'JEV key not configured');
    setLoading(false);
    window.location.reload();
  }

  return <div className="ai-provider-health-action"><button type="button" onClick={check} disabled={loading}><RefreshCw className={loading ? 'spin' : ''}/>{loading ? 'Checking…' : 'Check connections'}</button>{message && <small>{message}</small>}</div>;
}
