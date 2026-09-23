import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { resolveWebsiteSectionOrder, websitePageOptions, type WebsiteDraftBlock, type WebsiteLayoutSnapshot, type WebsitePageKey } from '@/lib/website-layout';
import { WebsiteWorkspace, type WebsiteWorkspaceProduct, type WebsiteWorkspaceStore } from './website-workspace';

export const dynamic = 'force-dynamic';

const emptyBlocks: WebsiteDraftBlock[] = [];
type DraftVersion = { page_id: string; version_number: number; snapshot: unknown; created_at: string };
const parseSnapshot = (snapshot: unknown): WebsiteLayoutSnapshot => {
  if (!snapshot || typeof snapshot !== 'object') return { blocks: emptyBlocks };
  const value = snapshot as Partial<WebsiteLayoutSnapshot>;
  return { blocks: Array.isArray(value.blocks) ? value.blocks as WebsiteDraftBlock[] : emptyBlocks, section_order: Array.isArray(value.section_order) ? value.section_order : undefined };
};

export default async function WebsiteWorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login?next=/admin/workspace/website');

  const [{ data: profile }, { data: employee }, { data: assurance }, stores, categories, offers] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    getStores(), getCategories(), getCatalogOffers(),
  ]);
  const canEdit = Boolean(profile && ['owner', 'admin', 'editor'].includes(profile.role) && employee?.status === 'active' && assurance?.currentLevel === 'aal2');
  const { data: pageRows } = await supabase.from('site_pages').select('id,slug,status,published_layout,layout_published_at').in('slug', websitePageOptions.map((page) => page.slug));
  const pageBySlug = new Map((pageRows ?? []).map((page) => [page.slug, page]));
  const ids = (pageRows ?? []).map((page) => page.id);
  const { data: versions } = ids.length ? await supabase.from('site_page_versions').select('page_id,version_number,snapshot,created_at').in('page_id', ids).eq('change_note', 'workspace_draft').order('version_number', { ascending: false }) : { data: [] };
  const latestVersion = new Map<string, DraftVersion>();
  for (const version of (versions ?? []) as DraftVersion[]) if (!latestVersion.has(version.page_id)) latestVersion.set(version.page_id, version);

  const layouts: Record<WebsitePageKey, WebsiteDraftBlock[]> = { home: [], stores: [], product: [] };
  const publishedLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]> = { home: [], stores: [], product: [] };
  const orders: Record<WebsitePageKey, string[]> = { home: resolveWebsiteSectionOrder('home', []), stores: resolveWebsiteSectionOrder('stores', []), product: resolveWebsiteSectionOrder('product', []) };
  const publishedOrders: Record<WebsitePageKey, string[]> = { home: resolveWebsiteSectionOrder('home', []), stores: resolveWebsiteSectionOrder('stores', []), product: resolveWebsiteSectionOrder('product', []) };
  const statuses: Partial<Record<WebsitePageKey, string>> = {};
  for (const page of websitePageOptions) {
    const row = pageBySlug.get(page.slug);
    if (!row) continue;
    statuses[page.key] = row.status;
    const publishedSnapshot = parseSnapshot(row.published_layout);
    publishedLayouts[page.key] = publishedSnapshot.blocks;
    publishedOrders[page.key] = resolveWebsiteSectionOrder(page.key, publishedSnapshot.blocks, publishedSnapshot.section_order);
    const savedDraft = latestVersion.get(row.id)?.snapshot;
    const draftSnapshot = savedDraft ? parseSnapshot(savedDraft) : publishedSnapshot;
    layouts[page.key] = draftSnapshot.blocks;
    orders[page.key] = resolveWebsiteSectionOrder(page.key, draftSnapshot.blocks, draftSnapshot.section_order);
  }

  const workspaceStores: WebsiteWorkspaceStore[] = stores.map((store) => ({ id: store.id, name: store.name, slug: store.slug, logoUrl: store.logo_url }));
  const workspaceProducts: WebsiteWorkspaceProduct[] = offers.flatMap((offer) => offer.products && offer.merchants ? [{
    productId: offer.products.id,
    slug: offer.products.slug,
    title: offer.products.title,
    brand: offer.products.brand,
    imageUrl: offer.products.image_url,
    categoryId: offer.products.categories?.id ?? '',
    categoryName: offer.products.categories?.name ?? '',
    storeSlug: offer.merchants.slug,
    storeName: offer.merchants.name,
    price: offer.current_price,
    listPrice: offer.list_price,
    cashback: offer.cashback_amount,
    rating: offer.customer_rating,
    ratingCount: offer.rating_count,
    updatedAt: offer.updated_at,
    offerId: offer.id,
  }] : []);

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main website-workspace-main"><main className="admin-content website-workspace-content">
    <div className="website-compact-header"><h1>Website</h1><a className="website-open-link" href="/" target="_blank" rel="noreferrer">Open customer site ↗</a></div>
    {!canEdit && <div className="website-access-note" role="status">{assurance?.currentLevel !== 'aal2' ? 'Complete two-step verification to edit or publish. Your account must be an active Owner, Admin, or Editor.' : 'An active Owner, Admin, or Editor account is required to edit this workspace.'}</div>}
    <WebsiteWorkspace initialPage="home" initialLayouts={layouts} initialOrders={orders} publishedLayouts={publishedLayouts} publishedOrders={publishedOrders} pageStatuses={statuses} stores={workspaceStores} products={workspaceProducts} categories={categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug, parentId: category.parent_id }))} canEdit={canEdit}/>
  </main></section></main>;
}
