import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { SupportAssistant } from '@/components/support-assistant';
import { createClient } from '@/lib/supabase/server';
import './support.css';

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support');
  const { data: faqs } = await supabase.from('support_faqs').select('id,question,answer,keywords,scope').eq('is_active', true).order('display_order');
  return <><Header/><main className="support-layout"><BrowseNav items={[{ label: 'Profile', href: '/account?section=help' }, { label: 'Help & Legal', href: '/account?section=help' }, { label: 'Ask Glonni' }]} fallback="/account?section=help"/><div className="support-workspace" style={{ display: 'block' }}><SupportAssistant faqs={(faqs ?? []) as never[]}/></div></main></>;
}
