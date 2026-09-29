import { ChevronDown, FileCheck2, Landmark, WalletCards } from 'lucide-react';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

export type CustomerPolicy = {
  glonniTerms?: string;
  storeTerms?: string;
  cashbackTerms?: string;
  cashbackEligibility?: string;
  excludedItems?: string;
  couponRestrictions?: string;
  returnsRefunds?: string;
  validationCredit?: string;
};

export function CustomerPolicyAccordions({storeName,policy,heading,intro,openFirst=true}:{storeName:string;policy:CustomerPolicy;heading?:string;intro?:string;openFirst?:boolean}) {
  const storeSections=[
    {title:'Cashback Eligibility',copy:'When an order qualifies for cashback.',icon:<WalletCards/>,body:policy.cashbackEligibility},
    {title:'Excluded Categories & Items',copy:`Items or categories excluded by ${storeName}.`,icon:<FileCheck2/>,body:policy.excludedItems},
    {title:'Coupon & Offer Restrictions',copy:'How coupon codes and other offers affect cashback.',icon:<FileCheck2/>,body:policy.couponRestrictions},
    {title:'Returns, Cancellations & Refunds',copy:'What happens to cashback when an order changes.',icon:<FileCheck2/>,body:policy.returnsRefunds},
    {title:'Validation & Credit Rules',copy:'How provider confirmation and wallet credit work.',icon:<Landmark/>,body:policy.validationCredit},
  ].filter(section=>section.body?.trim());
  const legacySections=[
    {title:'Glonni Terms',copy:'How Glonni redirects, tracks and manages eligible rewards.',icon:<Landmark/>,body:policy.glonniTerms},
    {title:'Store Terms',copy:`Rules and exclusions that apply specifically to ${storeName}.`,icon:<FileCheck2/>,body:policy.storeTerms},
    {title:'Cashback Terms',copy:'Tracking, confirmation and withdrawal timing for eligible cashback.',icon:<WalletCards/>,body:policy.cashbackTerms},
  ].filter(section=>section.body?.trim());
  const sections=storeSections.length?[...storeSections,...(policy.storeTerms?.trim()?[{title:'Additional Store Terms',copy:`Additional rules for ${storeName}.`,icon:<FileCheck2/>,body:policy.storeTerms}]:[]),...(policy.cashbackTerms?.trim()?[{title:'Additional Cashback Terms',copy:'Additional provider or cashback conditions.',icon:<WalletCards/>,body:policy.cashbackTerms}]:[]),...(policy.glonniTerms?.trim()?[{title:'Glonni Terms',copy:'Platform journey, tracking and customer account rules.',icon:<Landmark/>,body:policy.glonniTerms}]:[])]:legacySections;
  if(!sections.length)return null;
  return <section className="customer-policy-accordions"><p className="eyebrow">TERMS &amp; CONDITIONS</p><h2>{renderWebsiteRichText(heading || `Before shopping with ${storeName}`)}</h2><p className="policy-intro">{intro ? renderWebsiteRichText(intro) : 'Open each section to review the terms that apply to this purchase.'}</p><div>{sections.map((section,index)=><details key={section.title} open={openFirst && index===0}><summary><span>{section.icon}<i><b>{section.title}</b><small>{section.copy}</small></i></span><ChevronDown/></summary><p>{section.body}</p></details>)}</div></section>;
}

export function parseCustomerPolicy(reviewNotes?:string|null):CustomerPolicy {
  try {
    const policies=JSON.parse(reviewNotes||'{}').policies||{};
    const has=(key:string)=>Object.prototype.hasOwnProperty.call(policies,key);
    const cashbackEligibility=policies.cashbackEligibility||'';
    const excludedItems=policies.excludedItems||'';
    const couponRestrictions=policies.couponRestrictions||'';
    const returnsRefunds=policies.returnsRefunds||'';
    const validationCredit=policies.validationCredit||'';
    const structuredStoreTerms=[excludedItems,couponRestrictions,returnsRefunds].filter(Boolean).join('\n\n').trim();
    const structuredCashbackTerms=[cashbackEligibility,validationCredit].filter(Boolean).join('\n\n').trim();
    const legacyStoreTerms=has('storeTerms')?policies.storeTerms:[policies.customerNotice,policies.returnsPolicy].filter(Boolean).join('\n\n');
    const legacyCashbackTerms=has('cashbackTerms')?policies.cashbackTerms:(policies.cashbackRules||'');
    return {
      glonniTerms:has('glonniTerms')?policies.glonniTerms:(policies.termsConditions||''),
      storeTerms:String(legacyStoreTerms||'').trim()===structuredStoreTerms?'':legacyStoreTerms,
      cashbackTerms:String(legacyCashbackTerms||'').trim()===structuredCashbackTerms?'':legacyCashbackTerms,
      cashbackEligibility,
      excludedItems,
      couponRestrictions,
      returnsRefunds,
      validationCredit,
    };
  } catch { return {}; }
}
