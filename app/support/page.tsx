import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { SupportAssistant } from '@/components/support-assistant';
import { SupportNav } from '@/components/support-nav';
import { createClient } from '@/lib/supabase/server';
import './support.css';

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support');
  const { data: faqs } = await supabase.from('support_faqs').select('id,question,answer,keywords,scope').eq('is_active', true).order('display_order');
  return <><Header/><main className="support-layout"><BrowseNav items={[{ label: 'Profile', href: '/account?section=help' }, { label: 'Help & Legal', href: '/help-legal' }, { label: 'Ask Glonni' }]} fallback="/help-legal"/><div className="support-workspace"><SupportNav active="/support"/><SupportAssistant faqs={(faqs ?? []) as never[]}/></div></main></>;
}
