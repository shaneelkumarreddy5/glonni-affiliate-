'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function ReferralShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === 'undefined' ? `/refer/${code}` : `${window.location.origin}/refer/${code}`;
  async function copyLink() { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <button type="button" onClick={copyLink} className="referral-copy">{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy referral link'}</button>;
}
