import { redirect } from 'next/navigation';

export default function ApprovalInboxRedirect() {
  redirect('/admin/ai-agents/ceo-operations?tab=approvals');
}
