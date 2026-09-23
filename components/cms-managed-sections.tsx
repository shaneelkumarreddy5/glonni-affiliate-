import { cache, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCatalogOffers, getCategories, type CatalogOffer } from '@/lib/catalog';
import { HomeOfferRail } from '@/components/home-offer-rail';
import { ScrollRail } from '@/components/scroll-rail';
import { getStores } from '@/lib/catalog';
import { renderWebsiteRichText } from '@/lib/website-rich-text';
import { systemPageSlug, type SystemPageKey } from '@/lib/system-pages';
import { websiteItemHref, type WebsiteDraftBlock, type WebsiteLayoutSnapshot, type WebsitePageKey } from '@/lib/website-layout';
import styles from './cms-managed-sections.module.css';

type ManagedBlock = WebsiteDraftBlock & { id: string };
type LayoutSnapshot = { blocks?: ManagedBlock[]; section_order?: string[]; core_content?: WebsiteLayoutSnapshot['core_content'] };

const loadPublishedLayout = cache(async (pageKey: SystemPageKey): Promise<WebsiteLayoutSnapshot> => {
  const supabase = await createClient();
  const { data: page } = await supabase.from('site_pages').select('id,published_layout').eq('slug', systemPageSlug(pageKey)).eq('status', 'published').maybeSingle();
  if (!page) return { blocks: [] };
  const snapshot = page.published_layout as LayoutSnapshot | null;
  if (Array.isArray(snapshot?.blocks)) return { blocks: snapshot.blocks, section_order: Array.isArray(snapshot.section_order) ? snapshot.section_order : undefined, core_content: snapshot.core_content && typeof snapshot.core_content === 'object' ? snapshot.core_content : {} };
  // Backwards-compatible path for previously published CMS blocks.
  const { data } = await supabase.from('site_page_blocks').select('id,block_type,title,body,cta_label,cta_href,image_url,config,device_visibility,is_active').eq('page_id', page.id).eq('is_active', true).order('display_order');
  const blocks = (data ?? []).map((item) => ({
    id: item.id,
    block_type: item.block_type,
    title: item.title ?? '',
    body: item.body ?? '',
    cta_label: item.cta_label ?? '',
    cta_href: item.cta_href ?? '',
    image_url: item.image_url ?? '',
    config: (item.config ?? {}) as WebsiteDraftBlock['config'],
    device_visibility: item.device_visibility as WebsiteDraftBlock['device_visibility'],
    is_active: item.is_active,
  })) as ManagedBlock[];
  return { blocks };
});

export async function getPublishedWebsiteLayout(pageKey: WebsitePageKey) {
  return loadPublishedLayout(pageKey);
}

const loadCatalogOffers = cache(async () => getCatalogOffers());
const loadCatalogCategories = cache(async () => getCategories());

function categoryBranchIds(slug: string, categories: Awaited<ReturnType<typeof getCategories>>) {
  const root = categories.find((category) => category.slug === slug);
  if (!root) return new Set<string>();
  const branch = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) if (category.parent_id && branch.has(category.parent_id) && !branch.has(category.id)) {
      branch.add(category.id);
      changed = true;
    }
  }
  return branch;
}

function uniqueOffers(offers: CatalogOffer[]) {
  const byProduct = new Map<string, CatalogOffer>();
  for (const offer of offers) {
    const id = offer.products?.id;
    if (!id) continue;
    const current = byProduct.get(id);
    const effective = (value: CatalogOffer) => (value.current_price ?? Infinity) - (value.cashback_amount ?? 0);
    if (!current || effective(offer) < effective(current)) byProduct.set(id, offer);
  }
  return [...byProduct.values()];
}

function offerOrder(offers: CatalogOffer[], sort: string) {
  const rows = uniqueOffers(offers);
  if (sort === 'trending') return rows.sort((a, b) => ((b.customer_rating ?? 0) * (b.rating_count ?? 0)) - ((a.customer_rating ?? 0) * (a.rating_count ?? 0)));
  if (sort === 'price_drop') return rows.sort((a, b) => ((b.list_price ?? b.current_price ?? 0) - (b.current_price ?? 0)) - ((a.list_price ?? a.current_price ?? 0) - (a.current_price ?? 0)));
  if (sort === 'newest') return rows.sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
  return rows.sort((a, b) => ((a.current_price ?? Infinity) - (a.cashback_amount ?? 0)) - ((b.current_price ?? Infinity) - (b.cashback_amount ?? 0)));
}

export async function CmsManagedSections({ pageKey, slot, blockIds, className = '', storeSlug, offers: suppliedOffers, fallback }: {
  pageKey: SystemPageKey;
  slot?: string;
  blockIds?: string[];
  className?: string;
  storeSlug?: string;
  offers?: CatalogOffer[];
  fallback?: ReactNode;
}) {
  const [layout, allOffers] = await Promise.all([loadPublishedLayout(pageKey), suppliedOffers ? Promise.resolve(suppliedOffers) : loadCatalogOffers()]);
  const publishedBlocks = layout.blocks as ManagedBlock[];
  const now = Date.now();
  const blocks = publishedBlocks.filter((block) => {
    const config = block.config ?? {};
    if (!block.is_active) return false;
    if (blockIds ? !blockIds.includes(block.id) : (config.slot ?? 'page_end') !== slot) return false;
    if (storeSlug && config.store_slug && config.store_slug !== storeSlug) return false;
    if (config.starts_at && Date.parse(config.starts_at) > now) return false;
    if (config.ends_at && Date.parse(config.ends_at) < now) return false;
    return true;
  });
  const categoryBlocks = blocks.filter((block) => block.config.category_slug);
  const needsCategories = categoryBlocks.length || blocks.some((block) => block.block_type === 'category_rail' || block.config.slide_targets?.some((target) => target.type === 'category'));
  const needsStores = blocks.some((block) => block.block_type === 'store_directory' || block.config.slide_targets?.some((target) => target.type === 'store'));
  const [categories, stores] = await Promise.all([
    needsCategories ? loadCatalogCategories() : Promise.resolve([]),
    needsStores ? getStores() : Promise.resolve([]),
  ]);
  const categoryBranches = new Map(categoryBlocks.map((block) => [block.id, categoryBranchIds(block.config.category_slug!, categories)]));
  if (!blocks.length) return fallback ?? null;

  return <div className={`${styles.wrap} ${className}`} data-cms-page={pageKey} data-cms-slot={slot}>{blocks.map((block) => {
    const config = block.config ?? {};
    const accent = /^#[0-9a-f]{6}$/i.test(config.accent ?? '') ? config.accent! : '#1454d9';
    const background = /^#[0-9a-f]{6}$/i.test(config.background ?? '') ? config.background! : '#ffffff';
    const visibility = block.device_visibility ?? 'all';
    if (block.block_type === 'hero' || block.block_type === 'banner') {
      const slides = [{ title: block.title, body: block.body, image_url: block.image_url, cta_label: block.cta_label, cta_href: block.cta_href }, ...(config.slides ?? [])].slice(0, Math.max(1, Math.min(10, Number(config.slide_count ?? 1))));
      const visibleSlides = slides.flatMap((slide, index) => {
        const target = config.slide_targets?.[index];
        let href = slide.cta_href;
        let itemImage: string | null | undefined;
        if (target && target.type !== 'manual') {
          if (target.type === 'product') {
            const product = allOffers.find((offer) => offer.products?.id === target.id)?.products;
            if (!product) return [];
            href = websiteItemHref('product', product.slug);
            itemImage = product.image_url;
          } else if (target.type === 'category') {
            const category = categories.find((item) => item.id === target.id);
            if (!category) return [];
            href = websiteItemHref('category', category.slug);
            itemImage = category.image_url;
          } else if (target.type === 'store') {
            const store = stores.find((item) => item.id === target.id);
            if (!store) return [];
            href = websiteItemHref('store', store.slug);
            itemImage = store.logo_url;
          }
        }
        return [{ slide, index, href, image: slide.image_url || itemImage }];
      });
      if (!visibleSlides.length) return null;
      return <div key={block.id} className={`${styles.bannerSlides} ${visibility === 'mobile' ? styles.mobileOnly : visibility === 'desktop' ? styles.desktopOnly : ''}`} aria-label={`${block.title || 'Promotion'} banner slides`}>
        {visibleSlides.map(({ slide, index, href, image }) => {
          const content = <>{image && <picture className={styles.bannerPicture}>{index === 0 && config.mobile_image_url && <source media="(max-width: 700px)" srcSet={config.mobile_image_url}/>}<img src={image} alt=""/></picture>}<div className={styles.copy}><span className={styles.bannerEyebrow}>{block.block_type === 'hero' ? 'FEATURED' : 'PROMOTION'}</span>{slide.title && <h2>{slide.title}</h2>}{slide.body && <p>{renderWebsiteRichText(slide.body)}</p>}{href && <span className={styles.slideCta}>{slide.cta_label || 'Open page'} →</span>}</div></>;
          const slideClass = `${styles.block} ${styles.bannerBlock} ${styles.bannerSlide} ${styles[block.block_type] ?? ''} ${styles[`size_${config.slide_shapes?.[index] ?? config.banner_size ?? 'wide'}`] ?? ''}`;
          const slideStyle = { '--accent': accent, '--background': background } as React.CSSProperties;
          return href ? <a key={`${block.id}-slide-${index}`} href={href} className={`${slideClass} ${styles.bannerSlideLink}`} style={slideStyle} aria-label={`${slide.title || 'Promotion'} — ${slide.cta_label || 'Open page'}`}>{content}</a> : <section key={`${block.id}-slide-${index}`} className={slideClass} style={slideStyle}>{content}</section>;
        })}
      </div>;
    }

    if (block.block_type === 'product_rail' || block.block_type === 'store_rail') {
      if (block.block_type === 'product_rail' && config.source_mode === 'curated' && !config.product_ids?.length) return null;
      const filtered = allOffers.filter((offer) => {
        if ((block.block_type === 'store_rail' || config.store_slug) && offer.merchants?.slug !== config.store_slug) return false;
        if (config.category_slug && !categoryBranches.get(block.id)?.has(offer.products?.categories?.id ?? '')) return false;
        if (config.source_mode === 'curated' && config.product_ids?.length && !config.product_ids.includes(offer.products?.id ?? '')) return false;
        return true;
      });
      let ordered: CatalogOffer[];
      if (block.block_type === 'product_rail' && config.source_mode === 'curated') {
        const productIds = config.product_ids ?? [];
        const rank = new Map(productIds.map((id, index) => [id, index]));
        ordered = productIds.length
          ? uniqueOffers(filtered.filter((offer) => rank.has(offer.products?.id ?? ''))).sort((a, b) => (rank.get(a.products?.id ?? '') ?? 99) - (rank.get(b.products?.id ?? '') ?? 99))
          : [];
      } else {
        ordered = offerOrder(filtered, config.sort ?? 'best_deal');
      }
      ordered = ordered.slice(0, Math.max(1, Math.min(50, Number(config.count ?? 10))));
      if (!ordered.length) return null;
      const storeName = ordered[0]?.merchants?.name;
      return <section key={block.id} className={`${styles.productBlock} ${visibility === 'mobile' ? styles.mobileOnly : visibility === 'desktop' ? styles.desktopOnly : ''}`}>
        <header><div><p className="eyebrow">{block.block_type === 'store_rail' ? `${storeName ?? 'STORE'} DEALS` : 'FEATURED PRODUCTS'}</p><h2>{block.title || (block.block_type === 'store_rail' ? `Deals at ${storeName ?? 'this store'}` : 'Featured products')}</h2>{block.body && <span className={styles.richText}>{renderWebsiteRichText(block.body)}</span>}</div>{block.cta_label && block.cta_href && <a href={block.cta_href}>{block.cta_label} →</a>}</header>
        <HomeOfferRail offers={ordered} shape={config.visual_shape ?? 'standard'}/>
      </section>;
    }

    if (block.block_type === 'category_rail') {
      const ids = config.category_ids ?? [];
      const rank = new Map(ids.map((id, index) => [id, index]));
      const selected = (ids.length ? categories.filter((category) => rank.has(category.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : categories)
        .slice(0, Math.max(1, Math.min(50, Number(config.count ?? 10))));
      if (!selected.length) return null;
      return <section key={block.id} className={`${styles.catalogueRail} ${visibility === 'mobile' ? styles.mobileOnly : visibility === 'desktop' ? styles.desktopOnly : ''}`}>
        <header><div><p className="eyebrow">CATEGORIES</p><h2>{block.title || 'Browse categories'}</h2>{block.body && <span className={styles.richText}>{renderWebsiteRichText(block.body)}</span>}</div>{block.cta_label && block.cta_href && <a href={block.cta_href}>{block.cta_label} →</a>}</header>
        <ScrollRail className={styles.categoryCards} label={block.title || 'categories'}>{selected.map((category) => <a className={`${styles.catalogueCard} ${styles[`shape_${(config.visual_shape ?? 'standard').replaceAll('-', '_')}`]}`} href={`/category/${category.slug}`} key={category.id}><span className={styles.categoryImage}>{category.image_url ? <img src={category.image_url} alt=""/> : <b>{category.name.slice(0, 1)}</b>}</span><strong>{category.name}</strong><small>Explore category</small></a>)}</ScrollRail>
      </section>;
    }

    if (block.block_type === 'store_directory') {
      const ids = config.store_ids ?? [];
      const rank = new Map(ids.map((id, index) => [id, index]));
      const selected = (ids.length ? stores.filter((store) => rank.has(store.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : stores)
        .slice(0, Math.max(1, Math.min(50, Number(config.count ?? 10))));
      if (!selected.length) return null;
      return <section key={block.id} className={`${styles.catalogueRail} ${visibility === 'mobile' ? styles.mobileOnly : visibility === 'desktop' ? styles.desktopOnly : ''}`}>
        <header><div><p className="eyebrow">STORES</p><h2>{block.title || 'Shop by store'}</h2>{block.body && <span className={styles.richText}>{renderWebsiteRichText(block.body)}</span>}</div>{block.cta_label && block.cta_href && <a href={block.cta_href}>{block.cta_label} →</a>}</header>
        <ScrollRail className={styles.storeCards} label={block.title || 'stores'}>{selected.map((store) => <a className={`${styles.catalogueCard} ${styles[`shape_${(config.visual_shape ?? 'standard').replaceAll('-', '_')}`]}`} href={`/store/${store.slug}?from=/`} key={store.id}><span className={styles.storeImage}>{store.logo_url ? <img src={store.logo_url} alt=""/> : <b>{store.name.slice(0, 1)}</b>}</span><strong>{store.name}</strong><small>Shop this store</small></a>)}</ScrollRail>
      </section>;
    }

    return <section key={block.id} className={`${styles.block} ${styles.genericBlock}`} style={{ '--accent': accent, '--background': background } as React.CSSProperties} data-device={visibility}>
      <div className={styles.copy}>{block.title && <h2>{block.title}</h2>}{block.body && <p className={styles.richText}>{renderWebsiteRichText(block.body)}</p>}{block.cta_label && block.cta_href && <a href={block.cta_href}>{block.cta_label}</a>}</div>
      {block.image_url && <img src={block.image_url} alt=""/>}
    </section>;
  })}</div>;
}
