export type SystemPageKey = 'home' | 'deals' | 'stores' | 'category' | 'product' | 'profile' | 'wallet' | 'help';

export type SystemPageDefinition = {
  key: SystemPageKey;
  title: string;
  route: string;
  description: string;
  lockedSections: string[];
  slots: { key: string; label: string }[];
};

export const systemPageDefinitions: SystemPageDefinition[] = [
  { key: 'home', title: 'Home', route: '/', description: 'Homepage categories, stores and deal discovery.', lockedSections: ['Header', 'Categories', 'Stores', 'Deal rails', 'Footer'], slots: [{ key: 'after_hero', label: 'Below hero banners' }, { key: 'after_categories', label: 'Below categories' }, { key: 'before_footer', label: 'Above trust strip' }] },
  { key: 'deals', title: 'Deals', route: '/deals', description: 'Product search, filters and offer results.', lockedSections: ['Search', 'Filters', 'Product results'], slots: [{ key: 'after_heading', label: 'Below page heading' }, { key: 'before_results', label: 'Above deal results' }, { key: 'page_end', label: 'Below deal results' }] },
  { key: 'stores', title: 'Stores', route: '/stores', description: 'Connected store directory and store filters.', lockedSections: ['Store search', 'Category filters', 'Store results'], slots: [{ key: 'after_heading', label: 'Below store heading' }, { key: 'page_end', label: 'Below store directory' }] },
  { key: 'category', title: 'Category template', route: '/#categories', description: 'Shared layout used by every catalogue category.', lockedSections: ['Hierarchy', 'Subcategories', 'Product results'], slots: [{ key: 'after_heading', label: 'Below category heading' }, { key: 'before_results', label: 'Above category products' }, { key: 'page_end', label: 'Below category products' }] },
  { key: 'product', title: 'Product template', route: '/deals', description: 'Shared product detail and store-comparison layout.', lockedSections: ['Product identity', 'Variants', 'Store comparison', 'Specifications'], slots: [{ key: 'after_summary', label: 'Below product summary' }, { key: 'before_comparison', label: 'Above store comparison' }, { key: 'page_end', label: 'Below product information' }] },
  { key: 'profile', title: 'Profile', route: '/account', description: 'Customer profile, shopping preferences and security.', lockedSections: ['Identity', 'Account navigation', 'Security forms'], slots: [{ key: 'after_identity', label: 'Below profile identity' }, { key: 'page_end', label: 'Below profile workspace' }] },
  { key: 'wallet', title: 'Wallet & Payouts', route: '/wallet', description: 'Cashback records, balances and payout requests.', lockedSections: ['Balances', 'Transactions', 'Payout form'], slots: [{ key: 'after_heading', label: 'Below wallet heading' }, { key: 'page_end', label: 'Below wallet records' }] },
  { key: 'help', title: 'Help Centre', route: '/help', description: 'FAQs, guided support and escalation links.', lockedSections: ['Help search', 'FAQ results', 'Support links'], slots: [{ key: 'after_heading', label: 'Below help heading' }, { key: 'page_end', label: 'Below help content' }] },
];

export const systemPageSlug = (key: string) => `system-${key}`;
