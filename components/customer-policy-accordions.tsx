import { ChevronDown, FileCheck2, Landmark, WalletCards } from 'lucide-react';

export type CustomerPolicy = {
  glonniTerms?: string;
  storeTerms?: string;
  cashbackTerms?: string;
};

export function CustomerPolicyAccordions({storeName,policy,heading,intro}:{storeName:string;policy:CustomerPolicy;heading?:string;intro?:string}) {
  const sections=[
    {title:'Glonni Terms',copy:'How Glonni redirects, tracks and manages eligible rewards.',icon:<Landmark/>,body:policy.glonniTerms},
    {title:'Store Terms',copy:`Rules and exclusions that apply specifically to ${storeName}.`,icon:<FileCheck2/>,body:policy.storeTerms},
    {title:'Cashback Terms',copy:'Tracking, confirmation and withdrawal timing for eligible cashback.',icon:<WalletCards/>,body:policy.cashbackTerms},
  ].filter(section=>section.body?.trim());
  if(!sections.length)return null;
  return <section className="customer-policy-accordions"><p className="eyebrow">TERMS &amp; CONDITIONS</p><h2>{heading || `Before shopping with ${storeName}`}</h2><p className="policy-intro">{intro || 'Open each section to review the terms that apply to this purchase.'}</p><div>{sections.map((section,index)=><details key={section.title} open={index===0}><summary><span>{section.icon}<i><b>{section.title}</b><small>{section.copy}</small></i></span><ChevronDown/></summary><p>{section.body}</p></details>)}</div></section>;
}

export function parseCustomerPolicy(reviewNotes?:string|null):CustomerPolicy {
  try {
    const policies=JSON.parse(reviewNotes||'{}').policies||{};
    const has=(key:string)=>Object.prototype.hasOwnProperty.call(policies,key);
    return {
      glonniTerms:has('glonniTerms')?policies.glonniTerms:(policies.termsConditions||''),
      storeTerms:has('storeTerms')?policies.storeTerms:[policies.customerNotice,policies.returnsPolicy].filter(Boolean).join('\n\n'),
      cashbackTerms:has('cashbackTerms')?policies.cashbackTerms:(policies.cashbackRules||''),
    };
  } catch { return {}; }
}
