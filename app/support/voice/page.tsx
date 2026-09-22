import { redirect } from 'next/navigation';
import { Clock3, Headphones, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { SupportChannelNav } from '@/components/support-channel-nav';
import { createClient } from '@/lib/supabase/server';
import { createSupportTicket } from '../actions';
import '../support.css';

export default async function VoiceSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support/voice');
  return <><Header/><main className="support-layout"><BrowseNav items={[{ label: 'Profile', href: '/account?section=help' }, { label: 'Help & Legal', href: '/account?section=help' }, { label: 'Voice support' }]} fallback="/account?section=help"/><SupportChannelNav active="voice"/><div className="support-workspace" style={{ display: 'block' }}><section className="contact-page"><header className="support-page-head"><div><p>HUMAN SUPPORT · VOICE</p><h1>Request a support callback</h1><span>Tell us what you need help with and a support specialist can follow up by phone when a conversation is useful.</span></div></header><div className="contact-grid"><article className="contact-email"><Headphones size={30}/><p>VOICE SUPPORT</p><h2>Callback request</h2><span>We use your verified account contact details when available. Never place passwords, OTPs, PINs, or full payment details in the request.</span></article><article><Clock3/><h2>Expected response</h2><b>Usually within 24 hours</b><span>Callback timing may vary when a merchant or provider review is required.</span></article><article><ShieldCheck/><h2>For your safety</h2><span>Glonni will never ask for passwords, OTPs, PINs, card numbers, or full bank details on a call.</span></article></div><form className="channel-request-form" action={createSupportTicket}><input type="hidden" name="sourceChannel" value="voice"/><label>Category<select name="category" defaultValue="other"><option value="cashback">Cashback or eligibility</option><option value="withdrawal">Withdrawal or wallet</option><option value="order">Order or missing tracking</option><option value="deal">Deal, price or coupon</option><option value="account">Account help</option><option value="security">Security concern</option><option value="other">Something else</option></select></label><label>Subject<input name="subject" required minLength={4} maxLength={180} placeholder="Example: Please call about a missing cashback"/></label><label>What should we discuss?<textarea name="message" required minLength={10} maxLength={5000} rows={6} placeholder="Tell us what happened and the best time window for a callback. Do not include sensitive credentials."/></label><button className="primary" type="submit"><Headphones size={16}/>Request callback</button></form></section></div></main></>;
}
