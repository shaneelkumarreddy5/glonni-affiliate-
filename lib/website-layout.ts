export type WebsitePageKey = 'home' | 'stores' | 'product';
export type WebsiteBlockType = 'hero' | 'banner' | 'product_rail' | 'store_rail' | 'category_rail' | 'store_directory';
export type WebsiteVisualShape = 'standard' | 'wide' | 'strip' | 'square' | 'rectangle_horizontal' | 'rectangle_vertical';
export type WebsiteSlot =
  | 'hero' | 'after_hero' | 'after_categories' | 'after_stores'
  | 'after_best_deals' | 'after_trending' | 'after_price_drops' | 'before_footer'
  | 'store_after_intro' | 'store_before_products' | 'page_end'
  | 'after_summary' | 'before_comparison';

export type WebsiteCoreSection = {
  key: string;
  title: string;
  note: string;
};

export type WebsiteBannerSlide = {
  title: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
};

export type WebsiteSlideTarget = { type: 'manual' | 'product' | 'category' | 'store'; id?: string };

export function websiteItemHref(type: Exclude<WebsiteSlideTarget['type'], 'manual'>, slug: string) {
  return `/${type}/${encodeURIComponent(slug)}`;
}

export type WebsiteBlockConfig = {
  slot?: WebsiteSlot;
  store_slug?: string;
  category_slug?: string;
  category_ids?: string[];
  store_ids?: string[];
  source_mode?: 'all' | 'curated';
  product_ids?: string[];
  count?: number;
  sort?: 'best_deal' | 'trending' | 'price_drop' | 'newest';
  mobile_image_url?: string;
  banner_size?: Exclude<WebsiteVisualShape, 'standard'>;
  visual_shape?: WebsiteVisualShape;
  accent?: string;
  background?: string;
  starts_at?: string;
  ends_at?: string;
  slide_count?: number;
  slides?: WebsiteBannerSlide[];
  slide_targets?: WebsiteSlideTarget[];
  slide_shapes?: Exclude<WebsiteVisualShape, 'standard'>[];
};

export type WebsiteDraftBlock = {
  id: string;
  block_type: WebsiteBlockType;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  config: WebsiteBlockConfig;
  device_visibility: 'all' | 'desktop' | 'mobile';
  is_active: boolean;
};

export type WebsiteCoreContent = { title?: string; body?: string; count?: number; visual_shape?: WebsiteVisualShape; product_ids?: string[]; category_ids?: string[]; store_ids?: string[] };
export type WebsiteLayoutSnapshot = { blocks: WebsiteDraftBlock[]; section_order?: string[]; core_content?: Record<string, WebsiteCoreContent> };

export function removeWebsiteBannerSlide(block: WebsiteDraftBlock, index: number): WebsiteDraftBlock {
  const count = Math.max(1, Math.min(10, block.config.slide_count ?? 1));
  if (count <= 1 || index < 0 || index >= count) return block;
  const blank = (): WebsiteBannerSlide => ({ title: '', body: '', image_url: '', cta_label: '', cta_href: '' });
  const slides = [{ title: block.title, body: block.body, image_url: block.image_url, cta_label: block.cta_label, cta_href: block.cta_href }, ...(block.config.slides ?? [])];
  while (slides.length < count) slides.push(blank());
  slides.splice(index, 1);
  const [first, ...remaining] = slides;
  const targets = [...(block.config.slide_targets ?? [])];
  targets.splice(index, 1);
  const shapes = [...(block.config.slide_shapes ?? [])];
  shapes.splice(index, 1);
  return { ...block, ...first, config: { ...block.config, slides: remaining, slide_targets: targets, slide_shapes: shapes, slide_count: count - 1 } };
}

export const coreSectionsByPage: Record<WebsitePageKey, WebsiteCoreSection[]> = {
  home: [
    { key: 'hero', title: 'Main hero banners', note: 'Global hero content · movable, standard card styling' },
    { key: 'categories', title: 'Categories', note: 'Live catalogue categories · standard card styling' },
    { key: 'stores', title: 'Stores', note: 'Connected stores · standard card styling' },
    { key: 'best_deals', title: 'Best deals', note: 'Active approved offers · standard product cards' },
    { key: 'trending', title: 'Trending products', note: 'Active catalogue offers · standard product cards' },
    { key: 'price_drops', title: 'Price drops', note: 'Active catalogue offers · standard product cards' },
    { key: 'benefits', title: 'Glonni benefits', note: 'Shared site information' },
  ],
  stores: [
    { key: 'store_intro', title: 'Store introduction', note: 'Connected store identity and live data' },
    { key: 'store_products', title: 'Store products and filters', note: 'Approved offers · standard product cards' },
    { key: 'store_policies', title: 'Store policies', note: 'Store and cashback terms' },
    { key: 'store_faqs', title: 'Store FAQs', note: 'Active store-specific support answers' },
  ],
  product: [
    { key: 'product_summary', title: 'Product summary', note: 'Canonical product details' },
    { key: 'offer_comparison', title: 'Store offer comparison', note: 'Live offer and cashback details' },
    { key: 'price_history', title: 'Price history', note: 'Recorded catalogue prices' },
    { key: 'specifications', title: 'Specifications', note: 'Product data from the catalogue' },
    { key: 'product_information', title: 'Product information', note: 'Description and buying guidance' },
    { key: 'store_policies', title: 'Store policies', note: 'Store and cashback terms' },
    { key: 'product_faqs', title: 'Product FAQs', note: 'Relevant customer support answers' },
    { key: 'related_products', title: 'Related products', note: 'Related active catalogue products' },
    { key: 'disclosure', title: 'Price and cashback disclosure', note: 'Customer-facing information' },
  ],
};

const legacyPlacementByPage: Record<WebsitePageKey, Partial<Record<WebsiteSlot, { after?: string; before?: string }>>> = {
  home: {
    after_hero: { after: 'hero' }, after_categories: { after: 'categories' }, after_stores: { after: 'stores' },
    after_best_deals: { after: 'best_deals' }, after_trending: { after: 'trending' }, after_price_drops: { after: 'price_drops' },
    before_footer: { before: 'benefits' }, hero: { after: 'hero' },
  },
  stores: {
    store_after_intro: { after: 'store_intro' }, store_before_products: { before: 'store_products' }, page_end: { after: 'store_products' },
  },
  product: {
    after_summary: { after: 'product_summary' }, before_comparison: { before: 'offer_comparison' }, page_end: { after: 'disclosure' },
  },
};

export function defaultWebsiteSectionOrder(page: WebsitePageKey, blocks: WebsiteDraftBlock[] = []) {
  const core = coreSectionsByPage[page].map((section) => `core:${section.key}`);
  const result = [...core];
  const grouped = new Map<string, string[]>();
  const before = new Map<string, string[]>();
  for (const block of blocks) {
    const placement = legacyPlacementByPage[page][block.config.slot ?? 'page_end'];
    const anchor = placement?.after ?? placement?.before;
    if (!anchor) continue;
    const target = placement?.before ? before : grouped;
    const entries = target.get(anchor) ?? [];
    entries.push(`block:${block.id}`);
    target.set(anchor, entries);
  }
  const order: string[] = [];
  for (const key of result) {
    const coreKey = key.slice(5);
    order.push(...(before.get(coreKey) ?? []), key, ...(grouped.get(coreKey) ?? []));
  }
  const expected = new Set([...core, ...blocks.map((block) => `block:${block.id}`)]);
  for (const token of expected) if (!order.includes(token)) order.push(token);
  return order;
}

export function resolveWebsiteSectionOrder(page: WebsitePageKey, blocks: WebsiteDraftBlock[], savedOrder?: string[]) {
  const fallback = defaultWebsiteSectionOrder(page, blocks);
  if (!savedOrder) return fallback;
  const expected = new Set(fallback);
  const order: string[] = [];
  for (const token of savedOrder) if (expected.has(token) && !order.includes(token)) order.push(token);
  // A saved order is an explicit page composition: missing core entries were removed.
  // Always append only newly-added custom blocks so an incomplete old draft stays useful.
  for (const token of blocks.map((block) => `block:${block.id}`)) if (!order.includes(token)) order.push(token);
  return order;
}

export function moveWebsiteSection(order: string[], token: string, targetIndex: number) {
  const next = [...order];
  const fromIndex = next.indexOf(token);
  if (fromIndex < 0) return order;
  const [moving] = next.splice(fromIndex, 1);
  const insertionIndex = Math.max(0, Math.min(targetIndex - (fromIndex < targetIndex ? 1 : 0), next.length));
  next.splice(insertionIndex, 0, moving);
  return next;
}

export function insertWebsiteSection(order: string[], token: string, targetIndex: number) {
  if (order.includes(token)) return order;
  const next = [...order];
  const insertionIndex = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(insertionIndex, 0, token);
  return next;
}

export const websitePageOptions: { key: WebsitePageKey; label: string; slug: string; route: string }[] = [
  { key: 'home', label: 'Home page', slug: 'system-home', route: '/' },
  { key: 'stores', label: 'Store page', slug: 'system-stores', route: '/store' },
  { key: 'product', label: 'Product page', slug: 'system-product', route: '/product' },
];

export const slotsByPage: Record<WebsitePageKey, { key: WebsiteSlot; label: string }[]> = {
  home: [
    { key: 'hero', label: 'Hero banners' },
    { key: 'after_hero', label: 'After hero banners' },
    { key: 'after_categories', label: 'After categories' },
    { key: 'after_stores', label: 'After store directory' },
    { key: 'after_best_deals', label: 'After best deals' },
    { key: 'after_trending', label: 'After trending products' },
    { key: 'after_price_drops', label: 'After price drops' },
    { key: 'before_footer', label: 'Before footer' },
  ],
  stores: [
    { key: 'store_after_intro', label: 'After store introduction' },
    { key: 'store_before_products', label: 'Before store products' },
    { key: 'page_end', label: 'After store products' },
  ],
  product: [
    { key: 'after_summary', label: 'After product summary' },
    { key: 'before_comparison', label: 'Before store comparison' },
    { key: 'page_end', label: 'After product details' },
  ],
};

export function emptyWebsiteLayout(): WebsiteLayoutSnapshot {
  return { blocks: [] };
}
