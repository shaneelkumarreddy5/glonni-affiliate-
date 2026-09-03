import Link from 'next/link';
import { BotMessageSquare, FileQuestion, Headphones, Mail, TicketCheck } from 'lucide-react';

const items = [
  ['/support', 'Ask Glonni', BotMessageSquare],
  ['/support/requests', 'My support requests', TicketCheck],
  ['/support/contact', 'Contact support', Mail],
  ['/help', 'FAQs', FileQuestion],
] as const;

export function SupportNav({ active }: { active: string }) {
  return <nav className="support-nav" aria-label="Support navigation"><Link href="/help-legal" className="support-nav-title"><Headphones size={17}/>Help &amp; Support</Link><div>{items.map(([href, label, Icon]) => <Link href={href} className={active === href ? 'active' : ''} key={href}><Icon size={16}/>{label}</Link>)}</div></nav>;
}
