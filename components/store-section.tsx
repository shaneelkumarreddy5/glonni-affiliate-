import { getStores } from '@/lib/catalog';
import { ScrollRail } from '@/components/scroll-rail';
import { StoreCard } from '@/components/store-card';
import type { WebsiteCoreContent } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

export async function StoreSection({ content = {} }: { content?: WebsiteCoreContent }) {
  const available = await getStores();
  const ids = content.store_ids ?? [];
  const rank = new Map(ids.map((id, index) => [id, index]));
  const stores = (ids.length ? available.filter((store) => rank.has(store.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : available).slice(0, Math.max(1, Math.min(50, content.count ?? 10)));
  return <section className="home-store-section"><div className="section-title"><div><p className="eyebrow">AFFILIATE STORES</p><h2>{renderWebsiteRichText(content.title || 'Shop by store')}</h2>{content.body && <span className="home-managed-copy">{renderWebsiteRichText(content.body)}</span>}</div><a href="/stores">View all stores</a></div>{stores.length?<ScrollRail className="home-store-rail" label="stores">{stores.map((store) => <StoreCard key={store.id} href={`/store/${store.slug}?from=/`} name={store.name} logoUrl={store.logo_url}/>)}</ScrollRail>:<div className="home-empty"><b>Stores are being connected</b><span>Available stores will appear here.</span></div>}</section>;
}
