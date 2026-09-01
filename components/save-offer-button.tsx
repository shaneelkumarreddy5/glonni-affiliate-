'use client';

import { Heart } from 'lucide-react';
import { useEffect,useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const storageKey='glonni-saved-offers';
export type SavedOffer={offerId:string;productTitle:string;productSlug:string;imageUrl:string|null;merchantName:string;price:number|null;benefit:string;alert:'none'|'price_drop'|'deal_expiry'};
const read=():SavedOffer[]=>{try{return JSON.parse(localStorage.getItem(storageKey)||'[]') as SavedOffer[]}catch{return []}};

export function SaveOfferButton({offer}:{offer:Omit<SavedOffer,'alert'>}){const [saved,setSaved]=useState(false);useEffect(()=>{const fallback=read().some(x=>x.offerId===offer.offerId);setSaved(fallback);const supabase=createClient();supabase.auth.getUser().then(async({data:{user}})=>{if(!user)return;const{data}=await supabase.from('saved_offers').select('offer_id').eq('profile_id',user.id).eq('offer_id',offer.offerId).maybeSingle();setSaved(Boolean(data));});},[offer.offerId]);const toggle=async()=>{const next=!saved;setSaved(next);const items=read(),exists=items.some(x=>x.offerId===offer.offerId);localStorage.setItem(storageKey,JSON.stringify(next?[...items.filter(x=>x.offerId!==offer.offerId),{...offer,alert:'price_drop'}]:items.filter(x=>x.offerId!==offer.offerId)));window.dispatchEvent(new Event('glonni-saved-offers'));const supabase=createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return;const result=next?await supabase.from('saved_offers').upsert({profile_id:user.id,offer_id:offer.offerId,alert_type:'price_drop'}):await supabase.from('saved_offers').delete().eq('profile_id',user.id).eq('offer_id',offer.offerId);if(result.error)setSaved(!next);};return <button type="button" className={`save-offer ${saved?'saved':''}`} onClick={toggle} aria-pressed={saved}><Heart size={15} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save deal'}</button>}

export { storageKey,read };
