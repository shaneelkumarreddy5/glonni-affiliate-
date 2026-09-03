'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import styles from './referral-share.module.css';

export function ReferralShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === 'undefined' ? `/refer/${code}` : `${window.location.origin}/refer/${code}`;
  async function copyLink() { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  async function shareLink() { if (navigator.share) { await navigator.share({ title: 'Join me on Glonni', text: 'Discover deals and eligible cashback on Glonni.', url: link }); return; } await copyLink(); }
  return <span className={styles.actions}><button type="button" onClick={copyLink} className="referral-copy">{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy link'}</button><button type="button" onClick={shareLink} className={styles.share}><Share2 size={15}/>Share</button></span>;
}
