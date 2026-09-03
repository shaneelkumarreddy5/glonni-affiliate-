import { redirect } from 'next/navigation';
import { Clock3, Mail, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import '../support.css';

export default async function ContactSupportPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support/contact');
  return <><Header/><main className="support-layout"><BrowseNav items={[{ label: 'Profile', href: '/account?section=help' }, { label: 'Help & Legal', href: '/account?section=help' }, { label: 'Contact support' }]} fallback="/account?section=help"/><div className="support-workspace" style={{ display: 'block' }}><section className="contact-page"><header className="support-page-head"><div><p>HUMAN SUPPORT</p><h1>Contact Glonni Support</h1><span>For an issue that needs a person, use a support request first so your details stay attached to one trackable conversation.</span></div></header><div className="contact-grid"><article className="contact-email"><Mail size={30}/><p>EMAIL SUPPORT</p><h2>support@glonni.com</h2><span>For general support. Please do not send sensitive banking or account-security information by email.</span><a href="mailto:support@glonni.com?subject=Glonni%20Support%20Request"><Mail size={16}/>Send email</a></article><article><Clock3/><h2>Expected response</h2><b>Usually within 24 hours</b><span>Response time may be longer on holidays or when a merchant/provider review is required.</span></article><article><ShieldCheck/><h2>For your safety</h2><span>Glonni will never ask for your password, OTP, PIN, card number, or full bank account number.</span></article></div><section className="contact-checklist"><h2>To help us resolve an issue faster</h2><div><span>✓ Store or merchant name</span><span>✓ Order ID, if available</span><span>✓ Date of click or order</span><span>✓ Screenshots, if relevant</span></div></section></section></div></main></>;
}
