'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function OwnerAiChat() {
  const [message, setMessage] = useState(''); const [answer, setAnswer] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function ask(event: FormEvent) { event.preventDefault(); if (!message.trim()) return; setLoading(true); setError(''); const supabase = createClient(); const { data, error: invokeError } = await supabase.functions.invoke('ai-owner-chat', { body: { mode: 'chat', message } }); if (invokeError || data?.error) setError(data?.error ?? invokeError?.message ?? 'Owner Chat is unavailable.'); else setAnswer(data.answer); setLoading(false); }
  async function brief() { setLoading(true); setError(''); const supabase = createClient(); const { data, error: invokeError } = await supabase.functions.invoke('ai-owner-chat', { body: { mode: 'daily_brief' } }); if (invokeError || data?.error) setError(data?.error ?? invokeError?.message ?? 'Daily brief is unavailable.'); else setAnswer(data.answer); setLoading(false); }
  return <article className="ai-panel owner-chat"><header><div><b>Ask Glonni</b><span>Owner-only AI advice</span></div><button type="button" onClick={brief} disabled={loading}>Daily brief</button></header>{answer && <div className="owner-answer">{answer}</div>}{error && <p className="preview-note">{error}</p>}<form onSubmit={ask}><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Ask about a policy, campaign, provider rule or operating decision." disabled={loading}/><button type="submit" disabled={loading}>{loading ? 'Thinking…' : 'Ask Glonni'}</button></form></article>;
}
