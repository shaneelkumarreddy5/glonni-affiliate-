import { createClient } from '@/lib/supabase/server';

export const BILL_SERVICES = [
  { key: 'mobile_recharge', label: 'Mobile recharge' },
  { key: 'dth', label: 'DTH' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'gas', label: 'Gas' },
  { key: 'water', label: 'Water' },
  { key: 'fastag', label: 'FASTag' },
] as const;

export const VOUCHER_CATEGORIES = [
  { key: 'shopping', label: 'Shopping' },
  { key: 'food_dining', label: 'Food & Dining' },
  { key: 'travel', label: 'Travel' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'gaming', label: 'Gaming' },
] as const;

export type BillServiceKey = (typeof BILL_SERVICES)[number]['key'];
export type VoucherCategoryKey = (typeof VOUCHER_CATEGORIES)[number]['key'];
export type CommerceSectionKey = 'coupons' | 'buy_coupons' | 'bill_payments';
export type CommerceVisibility = {
  coupons_enabled: boolean;
  buy_coupons_enabled: boolean;
  bill_payments_enabled: boolean;
  bill_services: Record<BillServiceKey, boolean>;
  voucher_categories: Record<VoucherCategoryKey, boolean>;
};

const trueFlags = <T extends string>(keys: readonly { key: T }[]) =>
  Object.fromEntries(keys.map(({ key }) => [key, true])) as Record<T, boolean>;

export const DEFAULT_COMMERCE_VISIBILITY: CommerceVisibility = {
  coupons_enabled: true,
  buy_coupons_enabled: true,
  bill_payments_enabled: true,
  bill_services: trueFlags(BILL_SERVICES),
  voucher_categories: trueFlags(VOUCHER_CATEGORIES),
};

export const UNAVAILABLE_COMMERCE_VISIBILITY: CommerceVisibility = {
  ...DEFAULT_COMMERCE_VISIBILITY,
  buy_coupons_enabled: false,
  bill_payments_enabled: false,
};

function normalizeFlags<T extends string>(keys: readonly { key: T }[], raw: unknown): Record<T, boolean> {
  const values = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return Object.fromEntries(keys.map(({ key }) => [key, values[key] === false ? false : true])) as Record<T, boolean>;
}

export function normalizeCommerceVisibility(raw: Record<string, unknown> | null): CommerceVisibility {
  if (!raw) return UNAVAILABLE_COMMERCE_VISIBILITY;
  return {
    coupons_enabled: raw.coupons_enabled === true,
    buy_coupons_enabled: raw.buy_coupons_enabled === true,
    bill_payments_enabled: raw.bill_payments_enabled === true,
    bill_services: normalizeFlags(BILL_SERVICES, raw.bill_services),
    voucher_categories: normalizeFlags(VOUCHER_CATEGORIES, raw.voucher_categories),
  };
}

export async function getCommerceVisibility(): Promise<{ settings: CommerceVisibility; connected: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('commerce_visibility')
    .select('coupons_enabled,buy_coupons_enabled,bill_payments_enabled,bill_services,voucher_categories')
    .eq('id', 1).maybeSingle();
  return { settings: normalizeCommerceVisibility(error ? null : data), connected: !error && !!data };
}

export type VoucherCatalogItem = {
  id: string;
  merchant_name: string;
  title: string;
  description: string;
  image_url: string | null;
  category_key: VoucherCategoryKey;
  face_value: number;
  selling_price: number;
  redemption_terms: string;
  expires_at: string | null;
};

export async function getVisibleVoucherCatalog(settings: CommerceVisibility): Promise<VoucherCatalogItem[]> {
  if (!settings.buy_coupons_enabled) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('voucher_catalog_items')
    .select('id,merchant_name,title,description,image_url,category_key,face_value,selling_price,redemption_terms,expires_at')
    .eq('status', 'active').order('merchant_name', { ascending: true }).limit(100);
  if (error || !data) return [];
  return data.filter((item) => settings.voucher_categories[item.category_key as VoucherCategoryKey] === true) as VoucherCatalogItem[];
}
