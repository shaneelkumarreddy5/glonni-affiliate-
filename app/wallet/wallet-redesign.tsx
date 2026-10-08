import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { WalletContent, type WalletContentParams } from './wallet-content';
import './wallet.css';
import './wallet-figma.css';
import './wallet-redesign.css';

type Props = { searchParams: Promise<WalletContentParams> };

export default async function WalletPage({ searchParams }: Props) {
  const params = await searchParams;
  if (params.tab === 'referrals') redirect('/account?section=referral');

  return <><Header/><main className="wallet-page wallet-redesign">
    <nav className="wallet-crumb"><Link href="/">Home</Link><span>›</span><b>My Wallet</b></nav>
    <WalletContent params={params}/>
  </main></>;
}
