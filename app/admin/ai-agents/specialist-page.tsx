import { addOwnerInstruction, decideAiWork, toggleAiAgent } from '../ai-actions';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSearch,
  ListChecks,
  Megaphone,
  PackageSearch,
  PenTool,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
} from 'lucide-react';

type SpecialistConfig = {
  key: string;
  name: string;
  eyebrow: string;
  description: string;
  icon: typeof Bot;
  area: string;
  scope: string;
  sourceTokens: string[];
  reviewLabel: string;
  connectedSummary: string;
  responsibilities: string[];
  defaults: string[];
  cards: { pending: string; risk: string; ready: string };
  pages: { label: string; detail: string; href: string }[];
};

export const specialistConfigs: Record<string, SpecialistConfig> = {
  'affiliate-partnerships': {
    key: 'affiliate_partnerships',
    name: 'Affiliate Partnerships & Provider Manager',
    eyebrow: 'AFFILIATE PARTNERSHIPS',
    description: 'Keeps provider connections, merchant relationships and tracking readiness healthy.',
    icon: Store,
    area: 'provider_policy',
    scope: 'affiliate_partnerships',
    sourceTokens: ['affiliate partnership', 'provider connection', 'tracking', 'merchant relationship', 'affiliate provider'],
    reviewLabel: 'provider and tracking decisions',
    connectedSummary: 'Provider, store and tracking areas connected to partnership work.',
    responsibilities: ['Verify provider and store connection readiness', 'Flag duplicate merchants or missing tracking', 'Prepare partnership changes for CEO scrutiny'],
    defaults: ['Use approved providers and connected stores only.', 'Flag duplicate store connections before recommending a change.', 'Keep tracking evidence with every provider recommendation.'],
    cards: { pending: 'Partnership items awaiting review', risk: 'Connection risks', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Affiliate Providers', detail: 'Provider connections and health', href: '/admin/providers' },
      { label: 'Stores & Brands', detail: 'Merchant catalogue and routing', href: '/admin' },
      { label: 'API Integrations', detail: 'Connected service settings', href: '/admin/integrations' },
      { label: 'Tracking Operations', detail: 'Clicks, conversions and postbacks', href: '/admin/analytics' },
    ],
  },
  'provider-compliance': {
    key: 'provider_compliance',
    name: 'Provider Policy & Compliance Manager',
    eyebrow: 'PROVIDER POLICY & COMPLIANCE',
    description: 'Checks provider rules, store terms and customer-facing policy recommendations.',
    icon: FileSearch,
    area: 'provider_policy',
    scope: 'provider_policy',
    sourceTokens: ['provider policy', 'compliance', 'terms', 'restriction', 'policy change', 'offer wording'],
    reviewLabel: 'policy and compliance decisions',
    connectedSummary: 'Provider, offer and store policy areas connected to compliance work.',
    responsibilities: ['Compare provider terms with Glonni rules', 'Flag restricted offers and policy conflicts', 'Show source and effective date for every recommendation'],
    defaults: ['Check provider terms before recommending a policy change.', 'Show the source and effective date for each rule.', 'Escalate legal or compliance uncertainty to the CEO.'],
    cards: { pending: 'Policy items awaiting review', risk: 'High-risk compliance flags', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Affiliate Providers', detail: 'Provider terms and connection status', href: '/admin/providers' },
      { label: 'Offers & Rewards', detail: 'Offer wording and reward rules', href: '/admin/offers' },
      { label: 'Store Policies', detail: 'Store-facing policy editor', href: '/admin' },
      { label: 'Policy instructions', detail: 'Rules currently assigned to this agent', href: '/admin/ai-agents/provider-compliance?tab=instructions' },
    ],
  },
  'catalogue-merchandising': {
    key: 'catalogue_merchandising',
    name: 'Catalogue & Merchandising Manager',
    eyebrow: 'CATALOGUE & MERCHANDISING',
    description: 'Enriches products, maps categories and prepares catalogue changes for approval.',
    icon: PackageSearch,
    area: 'catalogue',
    scope: 'catalogue',
    sourceTokens: ['catalogue', 'catalog', 'product', 'merchandising', 'category', 'variant'],
    reviewLabel: 'product and category decisions',
    connectedSummary: 'Products, categories, store catalogue and freshness monitoring.',
    responsibilities: ['Classify products into the correct category path', 'Check images, variants, offers and duplicate signals', 'Prepare catalogue work for CEO and admin approval'],
    defaults: ['Use connected affiliate stores only and keep every source reference.', 'Include images, variants, colours, prices and available offers.', 'Map every product to the correct category and subcategory path.', 'Never publish a product without CEO and admin approval.'],
    cards: { pending: 'Products awaiting CEO review', risk: 'Category or quality conflicts', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Products & Catalogue', detail: 'Canonical products and seller offers', href: '/admin/products' },
      { label: 'Categories', detail: 'Main, subcategory and sub-subcategory paths', href: '/admin/categories' },
      { label: 'Stores & Brands', detail: 'Store-specific catalogue assignments', href: '/admin' },
      { label: 'Product Freshness', detail: 'Stale data and refresh runs', href: '/admin/product-freshness' },
      { label: 'Change Approvals', detail: 'Published catalogue change history', href: '/admin/product-changes' },
    ],
  },
  'content-experience': {
    key: 'content_experience',
    name: 'Content & Experience Manager',
    eyebrow: 'CONTENT & EXPERIENCE',
    description: 'Prepares customer-facing copy, banners and merchandising recommendations.',
    icon: PenTool,
    area: 'content',
    scope: 'content',
    sourceTokens: ['content', 'copy', 'banner', 'creative', 'experience', 'merchandising'],
    reviewLabel: 'content and customer-experience decisions',
    connectedSummary: 'Deals, product catalogue and customer-facing store surfaces.',
    responsibilities: ['Recommend products and offers for placements', 'Prepare clear, accurate customer-facing copy', 'Submit banners and content for CEO and admin approval'],
    defaults: ['Use approved product and offer data only.', 'Keep copy accurate, clear and customer-safe.', 'Submit banners and page content for approval before publishing.'],
    cards: { pending: 'Content items awaiting review', risk: 'Items needing changes', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Deals & Banners', detail: 'Promotion and banner pipeline', href: '/admin/campaigns' },
      { label: 'Products', detail: 'Approved catalogue content', href: '/admin/products' },
      { label: 'Stores & Brands', detail: 'Store-facing content placements', href: '/admin' },
    ],
  },
  marketing: {
    key: 'marketing',
    name: 'Marketing Manager',
    eyebrow: 'MARKETING',
    description: 'Scores campaigns and prepares ads and social promotion for approval.',
    icon: Megaphone,
    area: 'marketing',
    scope: 'marketing',
    sourceTokens: ['marketing', 'campaign', 'ad', 'social', 'promotion', 'channel'],
    reviewLabel: 'campaign and promotion decisions',
    connectedSummary: 'Campaigns, paid ads, ad platforms and social analytics.',
    responsibilities: ['Score deals for paid and organic promotion', 'Recommend channel, audience and budget guardrails', 'Never publish or spend without approval'],
    defaults: ['Use approved products and offers only.', 'Keep spend within the approved budget and channel rules.', 'Prepare campaigns for review; never publish or spend automatically.'],
    cards: { pending: 'Campaigns awaiting CEO review', risk: 'High-risk campaign flags', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Deals & Banners', detail: 'Approved promotions to promote', href: '/admin/campaigns' },
      { label: 'Ads Manager', detail: 'Paid campaign setup and status', href: '/admin/ads' },
      { label: 'Ad Platforms', detail: 'Connected advertising accounts', href: '/admin/ad-platforms' },
      { label: 'Social Analytics', detail: 'Organic performance and insights', href: '/admin/social-analytics' },
    ],
  },
  'finance-cashback-risk': {
    key: 'finance_cashback_risk',
    name: 'Finance, Cashback & Risk Manager',
    eyebrow: 'FINANCE, CASHBACK & RISK',
    description: 'Checks commission, cashback, disputes and payout exceptions without changing money.',
    icon: CircleDollarSign,
    area: 'finance',
    scope: 'finance',
    sourceTokens: ['finance', 'cashback', 'commission', 'payout', 'wallet', 'financial', 'dispute'],
    reviewLabel: 'commission, cashback and payout decisions',
    connectedSummary: 'Cashback operations, reconciliation, wallets and payouts.',
    responsibilities: ['Flag commission and cashback exceptions', 'Score financial and payout risk', 'Never change balances or execute payouts directly'],
    defaults: ['Flag commission or cashback exceptions before recommending changes.', 'Never change balances or execute payouts directly.', 'Show provider evidence for every financial recommendation.'],
    cards: { pending: 'Financial cases awaiting review', risk: 'High-risk exceptions', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Cashback Operations', detail: 'Claims, rules and exceptions', href: '/admin/cashback-operations' },
      { label: 'Financial Validation', detail: 'Commission and reconciliation checks', href: '/admin/reconciliation' },
      { label: 'Wallet & Payouts', detail: 'Customer balances and withdrawals', href: '/admin/wallet' },
      { label: 'Payout Operations', detail: 'Payout batches and controls', href: '/admin/payout-operations' },
    ],
  },
  'fraud-security': {
    key: 'fraud_security',
    name: 'Fraud & Security Manager',
    eyebrow: 'FRAUD & SECURITY',
    description: 'Finds suspicious activity and prepares evidence-based security recommendations.',
    icon: ShieldCheck,
    area: 'security',
    scope: 'security',
    sourceTokens: ['fraud', 'security', 'suspicious', 'abuse', 'access', 'risk', 'account'],
    reviewLabel: 'fraud and security decisions',
    connectedSummary: 'Access reviews, activity history and reported orders.',
    responsibilities: ['Identify suspicious patterns and unusual activity', 'Prioritise cases for human investigation', 'Recommend holds without blocking money or accounts automatically'],
    defaults: ['Prioritise suspicious activity using evidence and risk level.', 'Recommend holds; never block accounts or funds automatically.', 'Escalate critical security events immediately.'],
    cards: { pending: 'Security cases awaiting review', risk: 'Critical risk alerts', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Access Reviews', detail: 'Admin access and security checks', href: '/admin/access-reviews' },
      { label: 'Activity & Audit Log', detail: 'Audited actions and events', href: '/admin/activity' },
      { label: 'Reported Orders', detail: 'Risk and abuse reports', href: '/admin/reported-orders' },
    ],
  },
  'customer-operations': {
    key: 'customer_operations',
    name: 'Customer Operations & Trust Manager',
    eyebrow: 'CUSTOMER OPERATIONS & TRUST',
    description: 'Triage support, missing orders and customer trust cases for human resolution.',
    icon: UsersRound,
    area: 'customer_operations',
    scope: 'customer_operations',
    sourceTokens: ['customer', 'support', 'missing', 'order', 'trust', 'notification', 'case'],
    reviewLabel: 'customer and support decisions',
    connectedSummary: 'Users, orders, support and customer notifications.',
    responsibilities: ['Classify customer requests and route them correctly', 'Prioritise missing cashback and order issues', 'Escalate sensitive or high-value cases to support staff'],
    defaults: ['Use relevant customer and order records only.', 'Recommend fair resolutions with supporting evidence.', 'Escalate sensitive or high-value cases for human review.'],
    cards: { pending: 'Customer cases awaiting review', risk: 'High-risk trust cases', ready: 'Ready for admin approval' },
    pages: [
      { label: 'Users', detail: 'Customer profiles and account state', href: '/admin/users' },
      { label: 'Orders & Earnings', detail: 'Orders, conversions and earnings', href: '/admin/orders' },
      { label: 'Support Centre', detail: 'Support queue and resolutions', href: '/admin/support' },
      { label: 'Notifications', detail: 'Customer communication history', href: '/admin/notifications' },
    ],
  },
};

type WorkItem = {
  id: string;
  title: string;
  summary: string;
  area: string;
  risk_level: string;
  status: string;
  proposed_by?: string | null;
  created_at: string;
};

const formatTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Never';

const statusLabel = (value?: string | null) => value === 'failed'
  ? 'Needs attention'
  : value === 'running'
    ? 'Running'
    : value === 'disabled' || value === 'not_connected'
      ? 'Stopped'
      : 'Working';

const sourceMatches = (config: SpecialistConfig, item: WorkItem) => {
  const source = `${item.proposed_by ?? ''} ${item.title} ${item.summary}`.toLowerCase();
  if (config.key === 'affiliate_partnerships') {
    return item.area === 'provider_policy' && /(affiliate partnership|provider connection|tracking|merchant relationship|affiliate provider)/.test(source);
  }
  if (config.key === 'provider_compliance') {
    return item.area === 'provider_policy' && /(provider policy|compliance|terms|restriction|policy change|offer wording)/.test(source);
  }
  // All other workflows have a dedicated database area. The area is the source
  // of truth, so a differently-worded work item cannot disappear from its agent.
  return item.area === config.area;
};

export async function SpecialistAgentPage({ slug, searchParams }: { slug: string; searchParams: Promise<{ tab?: string; success?: string; error?: string }> }) {
  const config = specialistConfigs[slug] ?? specialistConfigs['catalogue-merchandising'];
  const query = await searchParams;
  const tab = query.tab === 'instructions' ? 'instructions' : 'approvals';
  const supabase = await createClient();
  const [{ data: agent }, { data: jobs }, { data: workData }, { data: instructionData }] = await Promise.all([
    supabase.from('ai_agents').select('*').eq('key', config.key).maybeSingle(),
    supabase.from('ai_jobs').select('id,job_type,status,created_at,latest_error,output').eq('agent_key', config.key).order('created_at', { ascending: false }).limit(8),
    supabase.from('ai_work_items').select('id,title,summary,area,risk_level,status,proposed_by,created_at').order('created_at', { ascending: false }).limit(250),
    supabase.from('ai_owner_instructions').select('id,instruction,scope,status,created_at,updated_at').eq('status', 'active').order('created_at', { ascending: false }),
  ]);
  const work = (workData ?? []) as WorkItem[];
  const matchingWork = work.filter(item => sourceMatches(config, item));
  const pendingWork = matchingWork.filter(item => item.status === 'pending_approval');
  const reviewItems = matchingWork.filter(item => ['pending_approval', 'approved', 'on_hold'].includes(item.status));
  const approvedWork = matchingWork.filter(item => item.status === 'approved');
  const riskWork = pendingWork.filter(item => ['high', 'critical'].includes(item.risk_level));
  const corrections = matchingWork.filter(item => item.status === 'on_hold');
  const savedInstructions = (instructionData ?? []).filter(item => item.scope === config.scope || item.scope === 'all_agents').map(item => item.instruction as string);
  const instructionText = [...savedInstructions, ...config.defaults.filter(item => !savedInstructions.includes(item))];
  const runtime = agent?.runtime_status ?? 'not_connected';
  const working = agent?.is_enabled !== false && runtime !== 'disabled';
  const lastJob = jobs?.[0];
  const lastRun = agent?.last_run_at ?? lastJob?.created_at;
  const Icon = config.icon;
  const backHref = `/admin/ai-agents/${slug}`;
  const tabHref = (nextTab: string) => `${backHref}?tab=${nextTab}`;
  const selectedAgentHref = `/admin/ai-agents/ceo-operations?agent=${config.key}&tab=approvals`;

  return <main className="admin-v2 ai-admin"><AdminSidebar /><section className="admin-main specialist-shell"><main className="specialist-page">
    <a className="specialist-back" href="/admin/ai-agents">← Back to AI Agent Control Centre</a>
    <header className="specialist-head"><div className="specialist-title"><p>{config.eyebrow}</p><h1><Icon /> {config.name}</h1><span>{config.description}</span></div><div className="specialist-status-area"><span className={`specialist-status ${working ? 'working' : 'stopped'}`}><i />{working ? 'Working' : 'Stopped'}</span><form action={toggleAiAgent}><input type="hidden" name="agentKey" value={config.key} /><input type="hidden" name="enabled" value={String(!working)} /><input type="hidden" name="redirectTo" value={backHref} /><button className="specialist-run-button">{working ? 'Stop agent' : 'Run agent'}</button></form></div></header>
    {query.success && <div className="specialist-message success"><CheckCircle2 />{query.success}</div>}
    {query.error && <div className="specialist-message error"><AlertTriangle />{query.error}</div>}
    <section className="specialist-cards">
      <article><PackageSearch /><b>{pendingWork.length}</b><span>{config.cards.pending}</span><small>CEO queue</small></article>
      <article><ShieldAlert /><b>{riskWork.length + corrections.length}</b><span>{config.cards.risk}</span><small>Needs attention</small></article>
      <article><CheckCircle2 /><b>{approvedWork.length}</b><span>{config.cards.ready}</span><small>CEO approved</small></article>
      <article><Clock3 /><b>{lastRun ? formatTime(lastRun) : 'Never'}</b><span>Last agent run</span><small>{lastJob?.status ? lastJob.status.replaceAll('_', ' ') : 'No run recorded'}</small></article>
      <article><ListChecks /><b>{instructionText.length}</b><span>Instructions active</span><small>Owner-controlled rules</small></article>
    </section>
    <section className="specialist-pages-panel"><header><div><p>CONNECTED ADMIN PAGES</p><h2>Where this agent works</h2><span>{config.connectedSummary}</span></div><a href={selectedAgentHref}>Open CEO view <ArrowRight /></a></header><div className="specialist-page-links">{config.pages.map(page => <a href={page.href} key={`${page.label}-${page.href}`}><span><b>{page.label}</b><small>{page.detail}</small></span><ArrowRight /></a>)}</div></section>
    <section className="specialist-work-panel"><header><div><p>AGENT WORKSPACE</p><h2>{config.name}</h2><span>Cards, approvals and instructions are limited to this agent’s work.</span></div><span className="specialist-filter"><Sparkles /> Filter: {config.name}</span></header><nav className="specialist-tabs"><a className={tab === 'approvals' ? 'active' : ''} href={tabHref('approvals')}>Approvals <b>{pendingWork.length}</b></a><a className={tab === 'instructions' ? 'active' : ''} href={tabHref('instructions')}>Instructions <b>{instructionText.length}</b></a></nav>
      {tab === 'approvals' ? <div className="specialist-approval-layout"><div className="specialist-approval-list"><div className="specialist-panel-title"><div><h3>{config.name} approvals</h3><span>Only {config.reviewLabel} that reached CEO scrutiny appear here.</span></div><em>{reviewItems.length} items</em></div>{reviewItems.length ? reviewItems.map(item => <article className="specialist-approval-row" key={item.id}><div className="specialist-approval-main"><b>{item.title}</b><p>{item.summary}</p><small>{item.proposed_by || config.name} · {formatTime(item.created_at)}</small></div><em className={`risk-${item.risk_level}`}>{item.risk_level}</em><strong className={`work-${item.status}`}>{item.status === 'approved' ? 'Ready for admin' : item.status.replaceAll('_', ' ')}</strong>{item.status === 'pending_approval' ? <div className="specialist-row-actions"><form action={decideAiWork}><input type="hidden" name="workItemId" value={item.id} /><input type="hidden" name="decision" value="approved" /><input type="hidden" name="note" value={`Approved by CEO for ${config.name} admin review.`} /><input type="hidden" name="redirectTo" value={tabHref('approvals')} /><button className="approve">Approve for admin</button></form><form action={decideAiWork}><input type="hidden" name="workItemId" value={item.id} /><input type="hidden" name="decision" value="on_hold" /><input type="hidden" name="note" value="Request agent re-check and correction." /><input type="hidden" name="redirectTo" value={tabHref('approvals')} /><button>Re-check</button></form><form action={decideAiWork}><input type="hidden" name="workItemId" value={item.id} /><input type="hidden" name="decision" value="rejected" /><input type="hidden" name="note" value="Rejected by CEO." /><input type="hidden" name="redirectTo" value={tabHref('approvals')} /><button className="reject">Reject</button></form></div> : <span className="specialist-awaiting">{item.status === 'approved' ? 'Awaiting admin approval' : 'Returned to agent'}</span>}</article>) : <div className="specialist-empty"><CheckCircle2 /><b>No pending approvals for this agent</b><span>New work will appear here after this agent submits it and the CEO scrutinises it.</span></div>}</div><aside className="specialist-review-card"><h3>Approval flow</h3><p>This agent can prepare work, but the CEO checks its evidence and instructions before anything is sent to admin approval.</p><div><span>Source</span><b>{config.name}</b></div><div><span>Connected areas</span><b>{config.pages.length} admin pages</b></div><div><span>High risk</span><b>{riskWork.length} pending items</b></div><a href={selectedAgentHref}>Open CEO scrutiny <ArrowRight /></a></aside></div> : <div className="specialist-instruction-layout"><div className="specialist-instruction-list"><div className="specialist-panel-title"><div><h3>{config.name} instructions</h3><span>These rules are provided to the agent for every new job.</span></div><em>{instructionText.length} active</em></div>{instructionText.map((instruction, index) => <article key={`${instruction}-${index}`}><span>{index + 1}</span><p>{instruction}</p><small>{savedInstructions.includes(instruction) ? 'Saved instruction' : 'Default instruction'}</small></article>)}<form className="specialist-add-instruction" action={addOwnerInstruction}><input type="hidden" name="scope" value={config.scope} /><input type="hidden" name="redirectTo" value={tabHref('instructions')} /><textarea name="instruction" required minLength={3} placeholder={`Add an instruction for ${config.name}…`} /><div><select name="schedule"><option value="active">Active now</option><option value="scheduled">Schedule later</option></select><button>Save instruction</button></div></form></div><aside className="specialist-review-card"><h3>Instruction control</h3><p>Instructions are owner-controlled, recorded in Supabase and scoped to this agent. The agent follows them, the CEO reviews the result, and admin approves the final action.</p><div><span>Scope</span><b>{config.scope.replaceAll('_', ' ')}</b></div><div><span>Runtime</span><b>{statusLabel(runtime)}</b></div><a href={selectedAgentHref}>View in CEO page <ArrowRight /></a></aside></div>}
    </section>
    <section className="specialist-workflow"><span><Activity /> Connected pages</span><b>→</b><span><Bot /> Agent work</span><b>→</b><span><RefreshCw /> CEO scrutiny</span><b>→</b><span><CheckCircle2 /> Admin approval</span><b>→</b><span><ArrowRight /> Execution</span></section>
  </main></section></main>;
}
