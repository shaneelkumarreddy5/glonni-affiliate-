import { createClient } from '@/lib/supabase/server';

export type CatalogOffer = { id:string; current_price:number | null; list_price:number | null; cashback_amount:number | null; products:{title:string;slug:string;image_url:string | null;brand:string | null} | null; merchants:{name:string;slug:string} | null };
export async function getCatalogOffers() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [] as CatalogOffer[];
  const supabase = await createClient();
  const { data } = await supabase.from('offers').select('id,current_price,list_price,cashback_amount,products(title,slug,image_url,brand),merchants(name,slug)').eq('status','active').order('created_at',{ascending:false});
  return (data ?? []) as unknown as CatalogOffer[];
}
export async function getCatalogOffer(slug:string) { return (await getCatalogOffers()).find((offer) => offer.products?.slug === slug) ?? null; }
export async function getStores() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [] as {id:string;name:string;slug:string;logo_url:string|null}[];
  const supabase = await createClient(); const { data } = await supabase.from('merchants').select('id,name,slug,logo_url').eq('is_active',true).order('homepage_position'); return data ?? [];
}
