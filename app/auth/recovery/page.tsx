import Link from 'next/link';
import { RecoverySessionHandler } from '@/components/recovery-session-handler';

export default async function Recovery({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const { audience: requestedAudience } = await searchParams;
  const audience = requestedAudience === 'admin' ? 'admin' : 'customer';
  return <main className={audience === 'admin' ? 'admin-auth-page' : 'auth-page'}><section className={audience === 'admin' ? 'admin-auth-card' : 'auth-card'}>{audience === 'admin' && <a className="logo" href="/">Glonni</a>}<p className="eyebrow">SECURE PASSWORD RECOVERY</p><h1>Checking your recovery link</h1><p className={audience === 'customer' ? 'auth-intro' : undefined}>This one-time link expires after five minutes. Please keep this page open while Glonni verifies it.</p><RecoverySessionHandler audience={audience}/><Link className="auth-back" href={audience === 'admin' ? '/admin/forgot-password' : '/forgot-password'}>Request a new link</Link></section></main>;
}
