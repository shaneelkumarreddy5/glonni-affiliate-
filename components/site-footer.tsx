'use client';

import { usePathname } from 'next/navigation';

const links=[['About Glonni','/about'],['How Glonni Works','/how-it-works'],['Cashback Guide','/cashback-guide'],['Help Centre','/help'],['Contact & Report an Issue','/contact'],['Affiliate Disclosure','/affiliate-disclosure'],['Terms of Use','/terms'],['Privacy Policy','/privacy']];
export function SiteFooter(){const path=usePathname();if(path.startsWith('/admin'))return null;return <footer className="site-footer"><div><a className="logo" href="/"><span>Glonn</span><i>i</i></a><p>Smarter discovery for every shopping decision.</p></div><nav>{links.map(([label,href])=><a href={href} key={href}>{label}</a>)}</nav><small>Demo catalog: stores, prices, products and offers are mock data for testing. Glonni may earn a commission through qualifying links. Cashback is available only on offers marked eligible.</small></footer>}
