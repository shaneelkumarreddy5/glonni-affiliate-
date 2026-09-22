import Link from 'next/link';
import { Headphones, Mail, MessageSquareText, TicketCheck } from 'lucide-react';

type Channel = 'chat' | 'email' | 'voice' | 'requests';

const channels: Array<{ key: Channel; label: string; description: string; href: string; icon: typeof MessageSquareText }> = [
  { key: 'chat', label: 'AI chat', description: 'Get an instant answer', href: '/support', icon: MessageSquareText },
  { key: 'email', label: 'Email support', description: 'Send a tracked request', href: '/support/contact', icon: Mail },
  { key: 'voice', label: 'Voice support', description: 'Request a callback', href: '/support/voice', icon: Headphones },
  { key: 'requests', label: 'My requests', description: 'See replies and status', href: '/support/requests', icon: TicketCheck },
];

export function SupportChannelNav({ active }: { active: Channel }) {
  return <nav className="support-channel-nav" aria-label="Support channels">
    {channels.map(({ key, label, description, href, icon: Icon }) => <Link key={key} href={href} className={key === active ? 'active' : ''} aria-current={key === active ? 'page' : undefined}><Icon size={17}/><span><b>{label}</b><small>{description}</small></span></Link>)}
  </nav>;
}
