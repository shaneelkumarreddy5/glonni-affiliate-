import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { saveContentDraft, submitContentForCeoReview } from './actions';
import { managerPathForContentChannel } from '@/lib/content-routing';
import { ArrowRight, BadgeCheck, BarChart3, Bell, CheckCircle2, CircleAlert, Clock3, FileImage, ImagePlus, Megaphone, PenLine, Search, ShieldCheck, Sparkles, Store, UploadCloud } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = { tab?: string; offer?: string; q?: string; campaign?: string; success?: string; error?: string };
const TABS = [
  ['overview', 'Overview'], ['recommendations', 'Deal recommendations'], ['create', 'Create draft'], ['drafts', 'Draft library'], ['history', 'History'],
] as const;
const PLATFORM_NAMES: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', google_ads: 'Google Ads', meta_ads: 'Meta Ads' };
const cash = (value: unknown) => `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
const statusLabel = (status: string) => status.replaceAll('_', ' ');

function rankOffer(offer: any) {
  const price = Number(offer.current_price || 0), list = Number(offer.list_price || 0);
  const discount = list > price && list > 0 ? Math.min(25, Math.round((list - price) / list * 100)) : 0;
  const freshHours = offer.updated_at ? (Date.now() - new Date(offer.updated_at).getTime()) / 36e5 : 9999;
  return Math.min(96, 52 + Math.min(22, discount) + (offer.cashback_amount || offer.cashback_percent ? 8 : 0) + (offer.stock_status === 'in_stock' ? 7 : 0) + (freshHours < 72 ? 7 : 0));
}

async function searchEligibleOffers(supabase: Awaited<ReturnType<typeof createClient>>, query: string) {
  let offerQuery = supabase.from('offers').select('id,current_price,list_price,cashback_amount,cashback_percent,reward_terms,stock_status,ends_at,destination_url,status,updated_at,products(id,title,brand,image_url),merchants(id,name)').eq('status', 'active').not('current_price', 'is', null).not('destination_url', 'is', null).order('updated_at', { ascending: false });
  const needle = query.trim().slice(0, 100);
  if (!needle) return (await offerQuery.limit(250)).data ?? [];
  const literalNeedle = needle.replaceAll('%', '').replaceAll('_', '\\_');
  const [{ data: titledProducts }, { data: brandedProducts }, { data: merchants }] = await Promise.all([
    supabase.from('products').select('id').ilike('title', `%${literalNeedle}%`).limit(200),
    supabase.from('products').select('id').ilike('brand', `%${literalNeedle}%`).limit(150),
    supabase.from('merchants').select('id').ilike('name', `%${literalNeedle}%`).limit(100),
  ]);
  const productIds = [...new Set([...(titledProducts ?? []), ...(brandedProducts ?? [])].map((row) => row.id))];
  const merchantIds = (merchants ?? []).map((row) => row.id);
  const filters = [productIds.length ? `product_id.in.(${productIds.join(',')})` : '', merchantIds.length ? `merchant_id.in.(${merchantIds.join(',')})` : ''].filter(Boolean);
  if (!filters.length) return [];
  offerQuery = offerQuery.or(filters.join(','));
  return (await offerQuery.limit(500)).data ?? [];
}

function OfferPicker({ offers, selectedId }: { offers: any[]; selectedId?: string }) {
  return <label className="cm-field cm-offer-picker"><span>Source deal <i>Required</i></span><select name="offerId" required defaultValue={selectedId ?? ''}><option value="">Select an active deal</option>{offers.map((offer) => {
    const product = relation<any>(offer.products), merchant = relation<any>(offer.merchants);
    return <option key={offer.id} value={offer.id}>{product?.title ?? 'Product'} · {merchant?.name ?? 'Store'} · {cash(offer.current_price)}</option>;
  })}</select><small>This link stays attached to the active offer. Commission data is never included in customer creative.</small></label>;
}

export default async function ContentManagerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const tab = TABS.some(([key]) => key === query.tab) ? query.tab! : 'overview';
  const supabase = await createClient();
  const [campaignResult, rawOffers, agentResult] = await Promise.all([
    supabase.from('content_campaigns').select('*,content_campaign_assets(*)').order('updated_at', { ascending: false }).limit(100),
    searchEligibleOffers(supabase, query.q ?? ''),
    supabase.from('ai_agents').select('key,capability_status,runtime_status,is_enabled').in('key', ['marketing', 'content_experience']),
  ]);
  const campaigns = campaignResult.data;
  const campaignsError = campaignResult.error;
  const aiAgents = agentResult.data;
  const campaignsList = (campaigns ?? []) as any[];
  const assetsList = campaignsList.flatMap((campaign) => (campaign.content_campaign_assets ?? []).map((asset: any) => ({ ...asset, campaign })));
  const selectedCampaign = campaignsList.find((campaign) => campaign.id === query.campaign);
  const selectedAssets = (selectedCampaign?.content_campaign_assets ?? []) as any[];
  const offers = [...(rawOffers ?? [])] as any[];
  const requestedOfferId = query.offer ?? selectedCampaign?.source_offer_id;
  if (requestedOfferId && !offers.some((offer) => offer.id === requestedOfferId)) {
    const { data: selected } = await supabase.from('offers').select('id,current_price,list_price,cashback_amount,cashback_percent,reward_terms,stock_status,ends_at,destination_url,status,updated_at,products(id,title,brand,image_url),merchants(id,name)').eq('id', requestedOfferId).maybeSingle();
    if (selected?.status === 'active') offers.unshift(selected);
  }
  const eligible = offers.filter((offer) => offer.status === 'active' && Number(offer.current_price) > 0 && String(offer.destination_url ?? '').startsWith('http'));
  const recommendations = [...eligible].sort((a, b) => rankOffer(b) - rankOffer(a)).slice(0, 16);
  const selectedOffer = requestedOfferId ? eligible.find((offer) => offer.id === requestedOfferId) : recommendations[0];
  const agentMap = new Map((aiAgents ?? []).map((agent) => [agent.key, agent]));
  const connectedAgent = (key: string) => ['operational', 'partial'].includes(String(agentMap.get(key)?.capability_status));
  const draftCount = campaignsList.filter((row) => ['draft', 'changes_requested', 'on_hold'].includes(row.status)).length;
  const ceoCount = campaignsList.filter((row) => row.status === 'pending_review').length;
  const approvedCount = assetsList.filter((asset) => asset.status === 'admin_approved').length;
  const setupMissing = Boolean(campaignsError);
  const tabHref = (key: string, extras: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams({ tab: key });
    for (const [name, value] of Object.entries(extras)) if (value) params.set(name, value);
    return `/admin/content-manager?${params.toString()}`;
  };
  const signedMedia = new Map<string, string>();
  for (const path of [...new Set(assetsList.map((asset) => asset.media_path).filter(Boolean))] as string[]) {
    const { data } = await supabase.storage.from('content-creatives').createSignedUrl(path, 1800);
    if (data?.signedUrl) signedMedia.set(path, data.signedUrl);
  }
  const eventRows = await supabase.from('content_campaign_events').select('*').order('created_at', { ascending: false }).limit(80);
  const campaignNames = new Map(campaignsList.map((campaign) => [campaign.id, campaign.title]));

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><header className="admin-top"><PenLine size={21}/><b>Content Manager</b><span className="dashboard-date">Campaign content workspace · approval protected</span><Bell size={19}/><span className="avatar">SR</span></header>
    <main className="admin-content content-manager">
      <header className="cm-head"><div><p>WORKSPACE / CAMPAIGN CONTENT</p><h1>Content Manager</h1><span>Prepare channel-specific creative from approved deal recommendations. Final approval happens in the CEO workspace.</span></div></header>
      <div className="cm-flow"><span><BarChart3/>Marketing recommendation</span><b>→</b><span><PenLine/>Creative draft</span><b>→</b><span><ShieldCheck/>CEO review</span><b>→</b><span><CheckCircle2/>Admin approval</span><b>→</b><span><ArrowRight/>Channel manager queue</span></div>
      {query.success && <div className="cm-alert success"><CheckCircle2/>{query.success}</div>}
      {query.error && <div className="cm-alert error"><CircleAlert/>{query.error}</div>}
      {setupMissing && <div className="cm-alert error"><CircleAlert/>Content Manager storage is not initialized yet. Apply the included Supabase migration before saving drafts.</div>}
      <nav className="cm-tabs" aria-label="Content Manager pages">{TABS.map(([key, label]) => <Link key={key} className={tab === key ? 'active' : ''} href={tabHref(key, key === 'create' ? { offer: query.offer, q: query.q } : {})}>{label}{key === 'drafts' && <b>{draftCount}</b>}{key === 'recommendations' && <b>{recommendations.length}</b>}</Link>)}</nav>

      {tab === 'overview' && <>
        <section className="cm-stats"><article><Store/><small>Eligible deal matches</small><b>{recommendations.length}</b><span>Recent, active catalogue offers</span></article><article><PenLine/><small>Private drafts</small><b>{draftCount}</b><span>Not sent to any channel</span></article><article><Clock3/><small>At CEO review</small><b>{ceoCount}</b><span>Pending owner scrutiny</span></article><article><BadgeCheck/><small>Approved for routing</small><b>{approvedCount}</b><span>No automatic publishing</span></article></section>
        <section className="cm-overview-grid"><article className="cm-panel cm-recommend-preview"><header><div><p>DEAL SOURCES</p><h2>Recent eligible deals</h2><span>Rule-ranked using live offer freshness, discount, cashback availability and stock signal.</span></div><Link href={tabHref('recommendations')}>See candidates <ArrowRight size={15}/></Link></header>{recommendations.slice(0, 5).map((offer) => { const product = relation<any>(offer.products), merchant = relation<any>(offer.merchants); return <div className="cm-offer-row" key={offer.id}>{product?.image_url ? <img src={product.image_url} alt=""/> : <span className="cm-placeholder"><ImagePlus/></span>}<span><b>{product?.title ?? 'Product'}</b><small>{merchant?.name ?? 'Store'} · {product?.brand ?? 'Brand not listed'}</small></span><strong>{cash(offer.current_price)}</strong><b className="cm-score">{rankOffer(offer)}<small>match</small></b><Link href={tabHref('create', { offer: offer.id })}>Create draft</Link></div>; })}{!recommendations.length && <div className="cm-empty"><Search/><b>No eligible deals in this search</b><span>Try a different product, store or brand name.</span></div>}</article>
          <aside className="cm-side-stack"><article className="cm-panel"><h2>Connected agents</h2><p className="cm-connection"><Sparkles/><span><b>Marketing Manager</b><small>{connectedAgent('marketing') ? 'Connected' : 'Not connected · recommendations are rule-ranked'}</small></span><i className={connectedAgent('marketing') ? 'online' : ''}/></p><p className="cm-connection"><PenLine/><span><b>Content &amp; Experience</b><small>{connectedAgent('content_experience') ? 'Connected' : 'Not connected · use manual creative upload'}</small></span><i className={connectedAgent('content_experience') ? 'online' : ''}/></p><Link className="cm-subtle-link" href="/admin/ai-agents/content-experience">View agent status <ArrowRight size={14}/></Link></article><article className="cm-panel cm-safety"><ShieldCheck/><div><b>Managers are separate</b><p>Final-approved social and ad assets are routed to their own manager queues. Publishing and spend remain disabled until the corresponding accounts are connected.</p><Link href="/admin/social-manager">Social Media Manager</Link><Link href="/admin/ads">Ads Manager</Link></div></article></aside>
        </section>
      </>}

      {tab === 'recommendations' && <section className="cm-panel cm-recommendations"><header><div><p>DEAL RECOMMENDATIONS</p><h2>Choose a deal to turn into content</h2><span>These are rule-ranked from active offers—not an AI decision. Review live store, price, customer cashback and offer terms before drafting.</span></div><form action="/admin/content-manager" method="get"><input type="hidden" name="tab" value="recommendations"/><label><Search/><input name="q" defaultValue={query.q} placeholder="Search products or stores"/><button>Search</button></label></form></header><div className="cm-recommend-grid">{recommendations.map((offer) => { const product = relation<any>(offer.products), merchant = relation<any>(offer.merchants); const discount = Number(offer.list_price) > Number(offer.current_price) ? Math.round((Number(offer.list_price) - Number(offer.current_price)) / Number(offer.list_price) * 100) : null; return <article className={query.offer === offer.id ? 'selected' : ''} key={offer.id}>{product?.image_url ? <img className="cm-product-image" src={product.image_url} alt=""/> : <div className="cm-product-image cm-no-image"><ImagePlus/></div>}<div className="cm-recommend-body"><div className="cm-recommend-title"><span><small>{merchant?.name ?? 'Connected store'}</small><b>{product?.title ?? 'Untitled product'}</b></span><em>{rankOffer(offer)}<small>match</small></em></div><p>{product?.brand ?? 'Brand pending'}{offer.stock_status ? ` · ${String(offer.stock_status).replaceAll('_', ' ')}` : ''}</p><div className="cm-deal-metrics"><span><small>Current price</small><b>{cash(offer.current_price)}</b></span><span><small>Cashback</small><b>{offer.cashback_amount ? cash(offer.cashback_amount) : offer.cashback_percent ? `${offer.cashback_percent}%` : 'Available offer'}</b></span><span><small>Discount</small><b>{discount ? `${discount}% off` : 'No list price'}</b></span></div><p className="cm-rationale">Matched by active tracked link{offer.reward_terms ? ', customer reward terms' : ''}{discount ? ', price difference' : ''}{offer.stock_status === 'in_stock' ? ', and in-stock signal' : ''}. Verify offer terms before publication.</p><Link className="cm-primary-link" href={tabHref('create', { offer: offer.id })}>Use this deal <ArrowRight size={15}/></Link></div></article>; })}{!recommendations.length && <div className="cm-empty"><Search/><b>No active deals match</b><span>Check the offer status or try another search.</span></div>}</div></section>}

      {tab === 'create' && <section className="cm-create-layout"><article className="cm-panel cm-create-panel"><header><div><p>{selectedCampaign ? 'REVISE CONTENT DRAFT' : 'NEW CREATIVE DRAFT'}</p><h2>{selectedCampaign ? 'Update the returned draft' : 'Prepare content for selected channels'}</h2><span>One deal link and one shared creative for the destinations you choose. Product imagery is not copied; upload your designed creative.</span></div></header><div className="cm-agent-notice"><Sparkles/><span><b>AI content generation is unavailable right now</b><small>Content &amp; Experience Manager is not connected. You can still prepare and save a manual draft.</small></span><Link href="/admin/ai-providers">Provider setup</Link></div>
          {selectedCampaign && selectedAssets[0]?.media_path && signedMedia.get(selectedAssets[0].media_path) && <div className="cm-current-creative"><img src={signedMedia.get(selectedAssets[0].media_path)} alt="Current draft creative"/><span><b>Current creative attached</b><small>Choose a new file below to replace it across the selected platforms.</small></span></div>}
          <form action="/admin/content-manager" method="get" className="cm-picker-search"><input type="hidden" name="tab" value="create"/>{query.offer && <input type="hidden" name="offer" value={query.offer}/>}<label><Search/><input name="q" defaultValue={query.q} placeholder="Find across connected products and stores"/><button>Find deal</button></label></form>
          <form action={saveContentDraft} className="cm-create-form" encType="multipart/form-data">
          {selectedCampaign && <input type="hidden" name="campaignId" value={selectedCampaign.id}/>}
          <label className="cm-field"><span>Campaign name <i>Required</i></span><input name="title" required minLength={3} maxLength={180} placeholder="e.g. Diwali home essentials" defaultValue={selectedCampaign?.title ?? (selectedOffer ? `${relation<any>(selectedOffer.products)?.title ?? 'Deal'} · campaign` : '')}/></label>
          <OfferPicker offers={eligible} selectedId={selectedOffer?.id}/>
          {selectedOffer && <div className="cm-source-card">{relation<any>(selectedOffer.products)?.image_url ? <img src={relation<any>(selectedOffer.products)?.image_url} alt=""/> : <span><Store/></span>}<div><b>{relation<any>(selectedOffer.products)?.title ?? 'Selected product'}</b><small>{relation<any>(selectedOffer.merchants)?.name ?? 'Connected store'} · {cash(selectedOffer.current_price)} · {selectedOffer.cashback_percent ? `${selectedOffer.cashback_percent}% cashback` : selectedOffer.cashback_amount ? `${cash(selectedOffer.cashback_amount)} cashback` : 'No cashback configured'}</small><a href={selectedOffer.destination_url} target="_blank" rel="noreferrer">Check tracked offer destination <ArrowRight size={13}/></a></div></div>}
          <fieldset className="cm-channel-select"><legend>Draft destinations <i>Choose one or more</i></legend><label><input type="checkbox" name="platforms" value="instagram" defaultChecked={selectedAssets.some((asset) => asset.platform_key === 'instagram')}/><span><b>Instagram</b><small>Social post · account not connected</small></span></label><label><input type="checkbox" name="platforms" value="facebook" defaultChecked={selectedAssets.some((asset) => asset.platform_key === 'facebook')}/><span><b>Facebook</b><small>Social post · account not connected</small></span></label><label><input type="checkbox" name="platforms" value="google_ads" defaultChecked={selectedAssets.some((asset) => asset.platform_key === 'google_ads')}/><span><b>Google Ads</b><small>Paid creative · account not connected</small></span></label><label><input type="checkbox" name="platforms" value="meta_ads" defaultChecked={selectedAssets.some((asset) => asset.platform_key === 'meta_ads')}/><span><b>Meta Ads</b><small>Paid creative · account not connected</small></span></label></fieldset>
          <label className="cm-field"><span>Creative format</span><select name="format" defaultValue={selectedAssets[0]?.creative_format ?? 'square'}><option value="square">Square · feed post</option><option value="portrait">Portrait · feed creative</option><option value="story">Story / vertical</option><option value="landscape">Landscape · display / link preview</option></select></label>
          <div className="cm-copy-grid"><label className="cm-field"><span>Headline</span><input name="headline" maxLength={180} placeholder="Short, accurate headline" defaultValue={selectedAssets[0]?.headline ?? ''}/></label><label className="cm-field"><span>Button label</span><input name="cta" maxLength={80} placeholder="e.g. Shop deal" defaultValue={selectedAssets[0]?.cta_label ?? ''}/></label></div>
          <label className="cm-field"><span>Caption / post copy</span><textarea name="caption" rows={4} maxLength={4000} placeholder="Customer-facing copy. Keep the price and cashback accurate; do not promise unconfirmed savings." defaultValue={selectedAssets[0]?.caption ?? ''}/></label>
          <label className="cm-field"><span>Ad description (optional)</span><textarea name="description" rows={3} maxLength={4000} placeholder="Supporting description for paid placements" defaultValue={selectedAssets[0]?.description ?? ''}/></label>
          <label className="cm-field"><span>Admin brief (optional)</span><textarea name="brief" rows={2} maxLength={2000} placeholder="Internal context and approval notes; not shown to customers" defaultValue={selectedCampaign?.admin_brief ?? ''}/></label>
          <label className="cm-upload"><UploadCloud/><span><b>Upload designed creative</b><small>JPG, PNG or WebP · up to 10 MB · private until approved</small></span><input type="file" name="creative" accept="image/jpeg,image/png,image/webp"/></label>
          <div className="cm-form-footer"><span><ShieldCheck/>Draft saves privately. No external action runs from this button.</span><button disabled={setupMissing}><PenLine size={16}/>{selectedCampaign ? 'Save revised draft' : 'Save private draft'}</button></div>
        </form></article><aside className="cm-panel cm-create-steps"><h2>What happens next</h2><ol><li><span>1</span><div><b>Save the draft</b><small>Copy and uploaded creative stay private in Content Manager.</small></div></li><li><span>2</span><div><b>CEO review</b><small>The CEO checks the offer facts, copy, image and destination.</small></div></li><li><span>3</span><div><b>Admin approval in CEO workspace</b><small>Final approval is centralized in the CEO agent page.</small></div></li><li><span>4</span><div><b>Separate manager queues</b><small>Approved social and ad creatives appear in their own queues.</small></div></li></ol><div className="cm-no-publish"><CircleAlert/><span>Queue handoff does not publish a post or launch an ad.</span></div></aside></section>}

      {tab === 'drafts' && <section className="cm-panel cm-library"><header><div><p>PRIVATE CONTENT LIBRARY</p><h2>All campaign drafts</h2><span>Track each channel asset through CEO review, final admin approval and its separate manager queue.</span></div><Link className="cm-primary-link" href={tabHref('create', { offer: selectedOffer?.id })}>+ New draft</Link></header>
        {selectedCampaign && <div className="cm-selected-campaign"><div><small>SELECTED CAMPAIGN</small><h3>{selectedCampaign.title}</h3><p>Status: <b className={`cm-status status-${selectedCampaign.status}`}>{statusLabel(selectedCampaign.status)}</b></p>{selectedCampaign.decision_note && <p>{selectedCampaign.decision_note}</p>}</div>{selectedCampaign.status === 'approved' && <Link href="/admin/ai-agents/ceo-operations?agent=content_experience&tab=approvals">Open CEO page for final admin approval <ArrowRight size={14}/></Link>}{selectedCampaign.status === 'admin_approved' && <span>Final decision recorded. Each approved destination has been routed to its own manager.</span>}</div>}
        {assetsList.length ? <div className="cm-asset-list">{assetsList.map((asset) => { const imageUrl = asset.media_path ? signedMedia.get(asset.media_path) : null; const queueHref = managerPathForContentChannel(asset.channel_type === 'social' ? 'social' : 'paid_ads'); const queueName = asset.channel_type === 'social' ? 'Social Media Manager' : 'Ads Manager'; return <article className="cm-asset-card" key={asset.id}><div className="cm-asset-visual">{imageUrl ? <img src={imageUrl} alt="Creative draft"/> : <span><FileImage/><small>No uploaded creative</small></span>}</div><div className="cm-asset-main"><div className="cm-asset-top"><span className={`cm-channel-pill ${asset.channel_type}`}>{asset.channel_type === 'social' ? <PenLine/> : <Megaphone/>}{PLATFORM_NAMES[asset.platform_key] ?? asset.platform_key}</span><b className={`cm-status status-${asset.status}`}>{statusLabel(asset.status)}</b></div><h3>{asset.campaign.title}</h3><p className="cm-asset-headline">{asset.headline || 'No headline added'}</p><p className="cm-asset-copy">{asset.caption || asset.description || 'No customer copy added.'}</p><div className="cm-asset-facts"><span>Format · {asset.creative_format}</span><span>CTA · {asset.cta_label || 'Not set'}</span><a href={asset.destination_url} target="_blank" rel="noreferrer">Tracked deal link <ArrowRight size={13}/></a></div><div className="cm-asset-footer"><Link href={tabHref('drafts', { campaign: asset.campaign_id })}>Campaign details</Link>{['draft', 'on_hold', 'changes_requested'].includes(asset.status) && <Link href={tabHref('create', { offer: asset.campaign.source_offer_id, campaign: asset.campaign_id })}>Edit draft <PenLine size={14}/></Link>}{asset.status === 'draft' && <form action={submitContentForCeoReview}><input type="hidden" name="campaignId" value={asset.campaign_id}/><button>Send to CEO review <ArrowRight size={14}/></button></form>}{asset.status === 'pending_review' && <span className="cm-hold-note">Waiting for CEO review.</span>}{asset.status === 'approved' && <Link href="/admin/ai-agents/ceo-operations?agent=content_experience&tab=approvals">Waiting for final admin decision in CEO page <ArrowRight size={14}/></Link>}{asset.status === 'on_hold' && <span className="cm-hold-note">CEO requested a re-check. Revise the draft before resubmission.</span>}{asset.status === 'admin_approved' && <Link href={queueHref}>Routed to {queueName} queue <ArrowRight size={14}/></Link>}</div></div></article>; })}</div> : <div className="cm-empty"><FileImage/><b>No content drafts yet</b><span>Choose an eligible offer and start a content draft.</span><Link href={tabHref('recommendations')}>Browse deal recommendations <ArrowRight size={14}/></Link></div>}
      </section>}

      {tab === 'history' && <section className="cm-panel cm-history"><header><div><p>AUDIT TRAIL</p><h2>Content activity history</h2><span>Draft creation, CEO routing and final admin decisions are recorded here.</span></div></header>{(eventRows.data ?? []).length ? <div className="cm-history-list">{(eventRows.data ?? []).map((event: any) => <article key={event.id}><span className="cm-history-icon"><Clock3/></span><div><b>{statusLabel(event.event_type)}</b><p>{campaignNames.get(event.campaign_id) ?? 'Campaign draft'}{event.detail?.platform_key ? ` · ${PLATFORM_NAMES[event.detail.platform_key] ?? event.detail.platform_key}` : ''}</p><small>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</small></div><span className="cm-audit-id">Recorded</span></article>)}</div> : <div className="cm-empty"><Clock3/><b>No content activity yet</b><span>Actions will appear here once the first draft is saved.</span></div>}</section>}

      <footer className="cm-footer-note"><ShieldCheck/><span>Provider commission is admin-only. Draft copy uses customer-facing offer facts; external posting, ad launch, and spend remain disabled until approved connections and delivery APIs exist.</span></footer>
    </main></section></main>;
}
