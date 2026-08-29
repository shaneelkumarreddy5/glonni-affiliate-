'use client';

import { Heart } from 'lucide-react';
import { useEffect,useState } from 'react';

const storageKey='glonni-saved-offers';
export type SavedOffer={offerId:string;productTitle:string;productSlug:string;imageUrl:string|null;merchantName:string;price:number|null;benefit:string;alert:'none'|'price_drop'|'deal_expiry'};
const read=():SavedOffer[]=>{try{return JSON.parse(localStorage.getItem(storageKey)||'[]') as SavedOffer[]}catch{return []}};

export function SaveOfferButton({offer}:{offer:Omit<SavedOffer,'alert'>}){const [saved,setSaved]=useState(false);useEffect(()=>setSaved(read().some(x=>x.offerId===offer.offerId)),[offer.offerId]);const toggle=()=>{const items=read();const exists=items.some(x=>x.offerId===offer.offerId);localStorage.setItem(storageKey,JSON.stringify(exists?items.filter(x=>x.offerId!==offer.offerId):[...items,{...offer,alert:'price_drop'}]));setSaved(!exists);window.dispatchEvent(new Event('glonni-saved-offers'));};return <button type="button" className={`save-offer ${saved?'saved':''}`} onClick={toggle} aria-pressed={saved}><Heart size={15} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save deal'}</button>}

export { storageKey,read };
