import { addOwnerInstruction, decideAiWork, finalizeContentAsset, toggleAiAgent } from '../ai-actions';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, Bot, BriefcaseBusiness, CheckCircle2, CircleDollarSign, FileSearch, Megaphone, PackageSearch, PenTool, ShieldCheck, Store, UsersRound } from 'lucide-react';

const agentCards = [
  { key: 'catalogue_merchandising', name: 'Catalogue & Merchandising', description: 'Products, variants and category mapping.', scope: 'catalogue', icon: PackageSearch, area: 'catalogue' },
  { key: 'marketing', name: 'Marketing Manager', description: 'Campaigns, ads and promotion recommendations.', scope: 'marketing', icon: Megaphone, area: 'marketing' },
  { key: 'finance_cashback_risk', name: 'Finance, Cashback & Risk', description: 'Commission, cashback and financial exceptions.', scope: 'finance', icon: CircleDollarSign, area: 'finance' },
  { key: 'affiliate_partnerships', name: 'Affiliate Partnerships', description: 'Providers, merchants and tracking readiness.', scope: 'affiliate_partnerships', icon: BriefcaseBusiness, area: 'provider_policy' },
  { key: 'provider_compliance', name: 'Provider Policy & Compliance', description: 'Provider terms and compliance recommendations.', scope: 'provider_policy', icon: FileSearch, area: 'provider_policy' },
  { key: 'content_experience', name: 'Content & Experience', description: 'Customer-facing content and creative work.', scope: 'content', icon: PenTool, area: 'content' },
  { key: 'fraud_security', name: 'Fraud & Security', description: 'Suspicious activity and security decisions.', scope: 'security', icon: ShieldCheck, area: 'security' },
  { key: 'customer_operations', name: 'Customer Operations & Trust', description: 'Support, missing orders and trust cases.', scope: 'customer_operations', icon: UsersRound, area: 'customer_operations' },
] as const;

const defaults: Record<string, string[]> = {
  catalogue: ['Use connected affiliate stores only.', 'Include images, variants, colours, prices and offers.', 'Map every product to the correct category path.', 'Never publish a product without CEO and admin approval.'],
  marketing: ['Use approved products and offers only.', 'Keep spend within the approved budget.', 'Prepare campaigns for review; never publish automatically.'],
  finance: ['Flag commission or cashback exceptions before changes.', 'Never change balances or execute payouts directly.', 'Show provider evidence for every financial recommendation.'],
  affiliate_partnerships: ['Use approved providers and verify tracking readiness.', 'Flag duplicate store connections for CEO review.', 'Do not change provider routing without approval.'],
  provider_policy: ['Check provider terms before recommending policy changes.', 'Show the source and effective date for each rule.', 'Escalate compliance or legal uncertainty.'],
  content: ['Use approved product and offer data only.', 'Keep copy accurate, clear and customer-safe.', 'Submit banners and page content for approval before publishing.'],
  security: ['Prioritise suspicious activity using evidence and risk level.', 'Recommend holds; never block accounts or funds automatically.', 'Escalate critical security events immediately.'],
  customer_operations: ['Use customer and order records relevant to the case only.', 'Recommend fair resolutions with supporting evidence.', 'Escalate sensitive or high-value cases for human review.'],
};

const formatTime = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';
const statusLabel = (value?: string | null) => value === 'failed' ? 'Needs attention' : value === 'running' ? 'Running' : value === 'disabled' || value === 'not_connected' ? 'Stopped' : 'Working';

export async function CeoOperationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; agent?: string; success?: string; error?: string }> }) {
  const query = await searchParams;
  const selected = agentCards.find(item => item.key === query.agent) ?? agentCards[0];
  const tab = query.tab === 'instructions' ? 'instructions' : 'approvals';
  const supabase = await createClient();
  const [{ data: rows }, { data: work }, { data: instructions }, { data: contentAssets }] = await Promise.all([
    supabase.from('ai_agents').select('*').in('key', ['ceo_operations', ...agentCards.map(item => item.key)]),
    supabase.from('ai_work_items').select('id,title,summary,area,risk_level,status,proposed_by,created_at,context').order('created_at', { ascending: false }).limit(200),
    supabase.from('ai_owner_instructions').select('id,instruction,scope,status,created_at,updated_at').eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('content_campaign_assets').select('id,campaign_id,platform_key,channel_type,status,headline,caption,description,media_path,destination_url,ai_work_item_id').eq('status', 'approved').not('ai_work_item_id', 'is', null).limit(200),
  ]);
  const byKey = new Map((rows ?? []).map(row => [row.key, row]));
  const pending = (work ?? []).filter(item => item.status === 'pending_approval');
  const selectedWork = pending.filter(item => item.area === selected.area && (selected.key !== 'affiliate_partnerships' || String(item.proposed_by ?? '').toLowerCase().includes('partner')));
  const approvedContentAssets = (contentAssets ?? []).filter(asset => {
    const item = (work ?? []).find(row => row.id === asset.ai_work_item_id);
    const context = (item?.context ?? {}) as Record<string, string>;
    return item?.area === 'content' && item.status === 'approved' && context.content_campaign_id === asset.campaign_id && context.content_asset_id === asset.id;
  });
  const campaignIds = [...new Set(approvedContentAssets.map(asset => asset.campaign_id))];
  const { data: contentCampaigns } = campaignIds.length
    ? await supabase.from('content_campaigns').select('id,title,status,offer_snapshot').in('id', campaignIds)
    : { data: [] };
  const contentCampaignMap = new Map((contentCampaigns ?? []).map(campaign => [campaign.id, campaign]));
  const finalContentApprovals = await Promise.all(approvedContentAssets.filter(asset => contentCampaignMap.get(asset.campaign_id)?.status === 'approved').map(async asset => {
    const workItem = (work ?? []).find(row => row.id === asset.ai_work_item_id);
    const media = asset.media_path ? await supabase.storage.from('content-creatives').createSignedUrl(asset.media_path, 1800) : null;
    return { ...asset, workItem, campaign: contentCampaignMap.get(asset.campaign_id), mediaUrl: media?.data?.signedUrl ?? null };
  }));
  const selectedInstructions = (instructions ?? []).filter(item => item.scope === selected.scope || item.scope === 'all_agents');
  const allInstructionText = selectedInstructions.map(item => item.instruction);
  const instructionText = allInstructionText.length ? allInstructionText : (defaults[selected.scope] ?? []);
  const ceo = byKey.get('ceo_operations');
  const working = ceo?.is_enabled !== false && ceo?.runtime_status !== 'disabled';
  const countFor = (area: string) => pending.filter(item => item.area === area).length;
  const highRisk = pending.filter(item => ['high', 'critical'].includes(item.risk_level)).length;
  const readyForAdmin = (work ?? []).filter(item => item.status === 'approved').length;
  const corrections = (work ?? []).filter(item => item.status === 'on_hold').length;
  const connected = agentCards.filter(item => ['operational', 'partial'].includes(byKey.get(item.key)?.capability_status)).length;
  const activeInstructions = instructions?.length ?? 0;
  const panelHref = (agent: string, nextTab: string) => `/admin/ai-agents/ceo-operations?agent=${agent}&tab=${nextTab}`;
  return <main className="admin-v2 ai-admin"><AdminSidebar/><section className="admin-main ceo-shell"><main className="ceo-page">
    <div className="ceo-head"><div><p>AI COMPANY / CEO CONTROL</p><h1><Bot/> CEO &amp; Operations Manager</h1><span>Review and direct work from every AI agent.</span></div><div className="ceo-head-actions"><span className={`ceo-runtime ${working ? 'working' : 'stopped'}`}><i/>{working ? 'Working' : 'Stopped'}</span><form action={toggleAiAgent}><input type="hidden" name="agentKey" value="ceo_operations"/><input type="hidden" name="enabled" value={String(!working)}/><button className="ceo-toggle" aria-label={working ? 'Stop CEO agent' : 'Start CEO agent'}>{working ? 'Stop agent' : 'Run agent'}</button></form><a className="ceo-primary" href={panelHref(selected.key, 'instructions')}>+ New instruction</a></div></div>
    {query.success && <div className="ceo-message success"><CheckCircle2/>{query.success}</div>}{query.error && <div className="ceo-message error"><AlertTriangle/>{query.error}</div>}
    <section className="ceo-summary">{[
      ['Awaiting CEO review', pending.length, 'All agents'], ['High-risk items', highRisk, 'Require attention'], ['Ready for admin approval', readyForAdmin, 'CEO approved'], ['Agents working', `${connected}/${agentCards.length}`, 'Connected capabilities'], ['Returned for correction', corrections, 'Needs agent work'], ['Active instructions', activeInstructions || 24, 'Owner-controlled rules'],
    ].map(([label, value, hint]) => <article key={String(label)}><b>{value}</b><span>{label}</span><small>{hint}</small></article>)}</section>
    <section className="ceo-agent-section"><header><div><h2>AI agents</h2><p>Select an agent to review only its CEO-scrutinized work and instructions.</p></div><span>{agentCards.length} specialist agents</span></header><div className="ceo-agent-grid">{agentCards.map(item => { const Icon = item.icon; const row = byKey.get(item.key); const count = countFor(item.area); const isSelected = item.key === selected.key; return <a className={`ceo-agent-card ${isSelected ? 'selected' : ''}`} href={panelHref(item.key, tab)} key={item.key}><div className="ceo-agent-icon"><Icon/></div><div><b>{item.name}</b><p>{item.description}</p><strong>{count} pending</strong></div><em className={row?.runtime_status === 'failed' ? 'error' : ''}><i/>{statusLabel(row?.runtime_status)}</em></a>; })}</div></section>
    <section className="ceo-agent-panel"><header><div><h2>{selected.name}</h2><p>CEO-scrutinized work for this agent only.</p></div><span className="ceo-scope-note">This view is filtered to {selected.name}.</span></header><nav className="ceo-tabs"><a className={tab === 'approvals' ? 'active' : ''} href={panelHref(selected.key, 'approvals')}>Approvals <b>{selectedWork.length + (selected.key === 'content_experience' ? finalContentApprovals.length : 0)}</b></a><a className={tab === 'instructions' ? 'active' : ''} href={panelHref(selected.key, 'instructions')}>Instructions <b>{instructionText.length}</b></a></nav>
      {tab === 'approvals' ? <>
        <div className="ceo-approval-layout"><div className="ceo-approval-list"><div className="ceo-panel-title"><h3>{selected.name} approvals</h3><span>Pending work from this agent, shown with its source.</span></div>{selectedWork.length ? selectedWork.map(item => <article className="ceo-approval-row" key={item.id}><div><b>{item.title}</b><p>{item.summary}</p><small>{item.proposed_by} · {formatTime(item.created_at)}</small></div><em className={`risk-${item.risk_level}`}>{item.risk_level}</em><strong>{item.status.replaceAll('_', ' ')}</strong><div className="ceo-row-actions"><form action={decideAiWork}><input type="hidden" name="workItemId" value={item.id}/><input type="hidden" name="decision" value="approved"/><input type="hidden" name="note" value={`CEO review passed for ${selected.name}; send to final admin approval.`}/><button className="approve">Approve for admin</button></form><form action={decideAiWork}><input type="hidden" name="workItemId" value={item.id}/><input type="hidden" name="decision" value="on_hold"/><input type="hidden" name="note" value="Request agent re-check and correction."/><button>Re-check</button></form><form action={decideAiWork}><input type="hidden" name="workItemId" value={item.id}/><input type="hidden" name="decision" value="rejected"/><input type="hidden" name="note" value="Rejected during CEO review."/><button className="reject">Reject</button></form></div></article>) : <div className="ceo-empty"><CheckCircle2/><b>No pending CEO review for this agent</b><span>New work will appear here when this agent submits it.</span></div>}</div><aside className="ceo-review-card"><h3>Review and handoff</h3><p>The CEO review happens first. The admin then gives the final decision here before any content enters a channel manager queue.</p><div><span>Selected agent</span><b>{selected.name}</b></div><div><span>Connected pages</span><b>{selected.key === 'content_experience' ? 'Content Manager, Ads Manager, Social Media Manager' : 'Agent-related pages'}</b></div></aside></div>
        {selected.key === 'content_experience' && <section className="ceo-final-content"><header><div><p>CEO-REVIEWED CONTENT</p><h3>Final admin approval</h3><span>Approve each destination separately. Approved items route to the corresponding manager queue; they do not publish or spend automatically.</span></div><b>{finalContentApprovals.length} waiting</b></header>{finalContentApprovals.length ? <div className="ceo-final-content-grid">{finalContentApprovals.map(asset => { const snapshot = (asset.campaign?.offer_snapshot ?? {}) as Record<string, unknown>; const platform = String(asset.platform_key).replaceAll('_', ' '); return <article key={asset.id}>{asset.mediaUrl ? <img src={asset.mediaUrl} alt="Campaign creative"/> : <div className="ceo-final-placeholder"><PenTool/></div>}<div className="ceo-final-content-body"><div className="ceo-final-content-label"><b>{asset.channel_type === 'social' ? 'Social Media Manager' : 'Ads Manager'}</b><small>{platform}</small></div><h4>{asset.campaign?.title ?? String(snapshot.product ?? 'Campaign')}</h4><p>{asset.headline || asset.caption || asset.description || 'No customer-facing copy'}</p><small>Source: {String(snapshot.store ?? 'Connected store')} · CEO approved</small><a href={asset.destination_url} target="_blank" rel="noreferrer">View tracked destination →</a><form action={finalizeContentAsset}><input type="hidden" name="workItemId" value={asset.ai_work_item_id ?? ''}/><input type="hidden" name="redirectTo" value={panelHref('content_experience', 'approvals')}/><input name="note" placeholder="Optional decision note"/><div><button name="decision" value="admin_approved" className="approve">Approve &amp; route</button><button name="decision" value="rejected" className="reject">Reject</button></div></form></div></article>; })}</div> : <div className="ceo-empty"><CheckCircle2/><b>No content items are waiting for final approval</b><span>Content &amp; Experience drafts appear here after CEO review.</span></div>}</section>}
      </> : <div className="ceo-instruction-layout"><div className="ceo-instruction-list"><div className="ceo-panel-title"><h3>{selected.name} instructions</h3><span>Active rules used by this agent.</span></div>{instructionText.map((text, index) => <article key={`${text}-${index}`}><span>{index + 1}</span><p>{text}</p><small>{allInstructionText.includes(text) ? 'Saved instruction' : 'Default instruction'}</small></article>)}<form className="ceo-add-instruction" action={addOwnerInstruction}><input type="hidden" name="scope" value={selected.scope}/><input type="hidden" name="redirectTo" value={panelHref(selected.key, 'instructions')}/><textarea name="instruction" required minLength={3} placeholder="Add an instruction for this agent…"/><div><select name="schedule"><option value="active">Active now</option><option value="scheduled">Schedule later</option></select><button>Save instruction</button></div></form></div><aside className="ceo-review-card"><h3>How instructions work</h3><p>Only active instructions are sent to the selected agent. The CEO can add rules now and schedule date-based work later.</p><ul><li>Agent follows these rules</li><li>CEO reviews its result</li><li>Admin gives final approval</li></ul></aside></div>}
    </section>
    <div className="ceo-workflow"><span>Agent work</span><b>→</b><span>CEO scrutiny</span><b>→</b><span>Admin approval</span><b>→</b><span>Execution</span></div>
  </main></section></main>;
}
