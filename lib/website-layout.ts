export type WebsitePageKey = 'home' | 'stores' | 'product';
export type WebsiteBlockType = 'hero' | 'banner' | 'product_rail' | 'store_rail';
export type WebsiteSlot =
  | 'hero' | 'after_hero' | 'after_categories' | 'after_stores'
  | 'after_best_deals' | 'after_trending' | 'after_price_drops' | 'before_footer'
  | 'store_after_intro' | 'store_before_products' | 'page_end'
  | 'after_summary' | 'before_comparison';

export type WebsiteBlockConfig = {
  slot?: WebsiteSlot;
  store_slug?: string;
  category_slug?: string;
  source_mode?: 'all' | 'curated';
  product_ids?: string[];
  count?: number;
  sort?: 'best_deal' | 'trending' | 'price_drop' | 'newest';
  mobile_image_url?: string;
  banner_size?: 'wide' | 'strip' | 'square';
  accent?: string;
  background?: string;
  starts_at?: string;
  ends_at?: string;
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

export type WebsiteLayoutSnapshot = { blocks: WebsiteDraftBlock[] };

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
