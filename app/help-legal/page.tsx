import Link from 'next/link';
import { BotMessageSquare, ChevronRight, FileQuestion, Headphones, Mail, Scale, TicketCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import './help-legal.css';

const policies = [
  ['Privacy Policy', 'How we collect, use and protect your personal information.', '/privacy'],
  ['Terms & Conditions', 'The rules governing your use of Glonni.', '/terms'],
  ['Affiliate Disclosure', 'How Glonni uses affiliate links and earns commission.', '/affiliate-disclosure'],
  ['Cashback Terms', 'Eligibility, confirmation, reversals, claims and payouts.', '/cashback-guide'],
  ['Referral Terms', 'Eligibility and review rules for referrals.', '/terms#referrals'],
  ['Cookie Policy', 'Cookies, analytics and saved preferences.', '/privacy#cookies'],
  ['Merchant Returns & Refunds', 'Merchant purchases, delivery, returns and refunds.', '/terms#merchant-terms'],
  ['Contact & Grievance', 'How to raise support or policy concerns with Glonni.', '/contact'],
] as const;

export default function HelpLegalPage() {
  return <><Header/><main className="help-legal-page"><BrowseNav items={[{ label: 'Profile', href: '/account?section=help' }, { label: 'Help & Legal' }]} fallback="/account?section=help"/><header><p>HELP &amp; LEGAL</p><h1>Support and account documents</h1><span>Start with trusted answers, escalate to human support when needed, and read the policies that apply to your Glonni account.</span></header><section className="help-legal-top"><article><div className="help-icon"><Headphones/></div><div><p>HELP &amp; SUPPORT</p><h2>Answers first. People when it matters.</h2><span>Ask Glonni for normal questions, then create a trackable request for a human review.</span></div><div className="support-links"><Link href="/support"><BotMessageSquare/>Ask Glonni<ChevronRight size={15}/></Link><Link href="/support/requests"><TicketCheck/>My support requests<ChevronRight size={15}/></Link><Link href="/support/contact"><Mail/>Contact support<ChevronRight size={15}/></Link><Link href="/help"><FileQuestion/>Browse FAQs<ChevronRight size={15}/></Link></div></article></section><section className="policies"><div><p>LEGAL &amp; POLICIES</p><h2>Important documents</h2><span>Each document opens on its own page and will show its latest effective date when final legal copy is approved.</span></div><div className="policy-grid">{policies.map(([title, detail, href]) => <Link href={href} key={title}><Scale/><span><b>{title}</b><small>{detail}</small><em>Draft policy · review before launch</em></span><ChevronRight size={16}/></Link>)}</div></section></main></>;
}
