import Link from 'next/link';
import { Header } from '@/components/header';
export default function NotFound(){return <><Header/><main className="customer-state-page"><b>404</b><h1>We couldn’t find that page</h1><p>The link may be outdated, or the product, deal, store or category may no longer be available.</p><div><Link href="/">Go to homepage</Link><Link href="/deals">Browse deals</Link></div></main></>;}
