'use client';

import { useMemo, useState } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import { sendNotificationCampaign } from '@/app/admin/notifications/actions';

type Template = { id: string; template_key: string; name: string; category: string; subject: string; body: string };
const categories = [
  ['deals_offers', 'Deals and offers'],
  ['system_announcements', 'System announcements'],
] as const;

export function AdminNotificationCampaignForm({ templates }: { templates: Template[] }) {
  const options = useMemo(() => templates.filter((template) => ['deals_offers', 'system_announcements'].includes(template.category)), [templates]);
  const [category, setCategory] = useState<string>(categories[0][0]);
  const visibleOptions = options.filter((template) => template.category === category);
  const [templateId, setTemplateId] = useState(visibleOptions[0]?.id || '');
  const selected = options.find((template) => template.id === templateId) || visibleOptions[0];
  return <details className="notification-campaign"><summary><span><b>Create a notification</b><small>Send an in-app campaign to the right customer audience</small></span><Send size={17}/></summary><form action={sendNotificationCampaign}>
    <div className="campaign-fields"><label>Category<select value={category} onChange={(event) => { const next = event.target.value; setCategory(next); setTemplateId(options.find((template) => template.category === next)?.id || ''); }}>{categories.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Starting template<select name="templateId" value={selected?.id || ''} onChange={(event) => setTemplateId(event.target.value)} required>{visibleOptions.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label></div>
    <label>Notification title<input name="subject" key={`subject-${selected?.id}`} maxLength={180} required defaultValue={selected?.subject || ''}/></label><label>Message<input name="body" key={`body-${selected?.id}`} maxLength={2000} required defaultValue={selected?.body || ''}/></label>
    <div className="campaign-audience"><ShieldCheck size={18}/><span><b>{category === 'deals_offers' ? 'Only customers opted in to promotions' : 'All customer accounts'}</b><small>{category === 'deals_offers' ? 'Recipient IDs come from customer_preferences.marketing_updates. Essential service messages are separate.' : 'Each customer receives an individual in-app record tied to their account.'}</small></span></div>
    <div className="campaign-delivery"><span>In-app <b>Available</b></span><span>Email <b>Provider not connected</b></span><span>Push <b>Provider not connected</b></span></div>
    <label className="campaign-confirm"><input type="checkbox" name="confirmSend" value="yes" required/> I reviewed the audience and message.</label><button type="submit" disabled={!selected}>Send in-app notification</button>
  </form></details>;
}
