import { ExternalLink } from 'lucide-react';
import { getStores } from '@/lib/catalog';
import { ScrollRail } from '@/components/scroll-rail';
import type { WebsiteCoreContent } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

export async function StoreSection({ content = {} }: { content?: WebsiteCoreContent }) {
  const available = await getStores();
  const ids = content.store_ids ?? [];
  const rank = new Map(ids.map((id, index) => [id, index]));
  const stores = (ids.length ? available.filter((store) => rank.has(store.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : available).slice(0, Math.max(1, Math.min(50, content.count ?? 10)));
  const shape = content.visual_shape ?? 'standard';
  return <section className="home-store-section"><div className="section-title"><div><p className="eyebrow">AFFILIATE STORES</p><h2>{content.title || 'Shop by store'}</h2>{content.body && <span className="home-managed-copy">{renderWebsiteRichText(content.body)}</span>}</div><a href="/stores">View all stores</a></div>{stores.length?<ScrollRail className="home-store-rail" label="stores">{stores.map(store=><a className={`store${shape !== 'standard' ? ` shape-${shape.replaceAll('_','-')}` : ''}`} href={`/store/${store.slug}?from=/`} key={store.id}>{store.logo_url?<strong className="store-logo"><img src={store.logo_url} alt=""/></strong>:<strong>{store.name.slice(0,1)}</strong>}<span>{store.name}</span><ExternalLink size={14}/></a>)}</ScrollRail>:<div className="home-empty"><b>Stores are being connected</b><span>Available stores will appear here.</span></div>}</section>;
}
