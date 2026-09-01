import { MailCheck } from 'lucide-react';
import { HrPageShell } from '@/components/hr-page-shell';
import { createClient } from '@/lib/supabase/server';
import { revokeInvitation } from '@/app/admin/hr/actions';

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const messages = await searchParams;
  const supabase = await createClient();
  const { data: invites } = await supabase.from('admin_invitations').select('*').order('created_at', { ascending: false });
  return <HrPageShell title="Invitations" subtitle="Track delivery, expiry, revocation and secure employee onboarding.">
    {messages.error && <p className="preview-note error-note">{messages.error}</p>}
    {messages.success && <p className="preview-note success-note">{messages.success}</p>}
    <article className="store-table hr-wide"><div className="table-head"><div><a className="current">Invitation history</a><a href="/admin/team/new">Invite employee</a></div></div><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>WORK EMAIL</th><th>JOB TITLE</th><th>ROLE</th><th>STATUS</th><th>EXPIRES</th><th>ACTION</th></tr></thead><tbody>{(invites ?? []).map((invite) => <tr key={invite.id}><td><MailCheck size={18}/><span><strong>{invite.display_name}</strong><small>{new Date(invite.created_at).toLocaleDateString('en-IN')}</small></span></td><td>{invite.email}</td><td>{invite.job_title}</td><td>{invite.role}</td><td><em className={invite.status === 'accepted' ? 'status-active' : 'status-paused'}>{invite.status}</em></td><td>{new Date(invite.expires_at).toLocaleString('en-IN')}</td><td>{['pending', 'sent', 'failed'].includes(invite.status) ? <form action={revokeInvitation}><input type="hidden" name="invitationId" value={invite.id}/><button className="table-action danger-text">Revoke</button></form> : '—'}</td></tr>)}</tbody></table></div><footer>Invitation events remain permanently visible for security review. Revocation prevents the invitation from being treated as valid onboarding authorization.</footer></article>
  </HrPageShell>;
}
