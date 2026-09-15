import Link from 'next/link';
import { BotMessageSquare, CircleHelp, FileText, Headphones, Search } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { createClient } from '@/lib/supabase/server';
import './help.css';

type Faq={id:string;scope:string;question:string;answer:string};
const scopeNames:Record<string,string>={general:'Getting started',deal:'Deals & prices',cashback:'Cashback',wallet:'Wallet & payouts',account:'Account & security',merchant:'Stores',offer:'Offers'};
export default async function Help({searchParams}:{searchParams:Promise<{q?:string;topic?:string}>}){
  const params=await searchParams,supabase=await createClient();const{data}=await supabase.from('support_faqs').select('id,scope,question,answer').eq('is_active',true).order('display_order');const faqs=(data??[])as Faq[],query=params.q?.trim().toLowerCase()||'',topic=params.topic||'all';const filtered=faqs.filter(faq=>(topic==='all'||faq.scope===topic)&&(!query||`${faq.question} ${faq.answer}`.toLowerCase().includes(query)));const topics=['all',...new Set(faqs.map(faq=>faq.scope))];
  return <><Header/><main className="help-centre"><BrowseNav items={[{label:'Help centre'}]}/><header className="help-hero"><CircleHelp/><p>GLONNI HELP CENTRE</p><h1>How can we help?</h1><span>Find approved answers about deals, cashback, wallets, stores and your account.</span><form action="/help"><Search/><input name="q" defaultValue={params.q||''} placeholder="Search help topics"/><button>Search</button></form></header>
    <nav className="help-topics" aria-label="Help topics">{topics.map(value=><Link className={topic===value?'active':''} href={`/help?topic=${value}${query?`&q=${encodeURIComponent(query)}`:''}`} key={value}>{value==='all'?'All topics':scopeNames[value]||value}</Link>)}</nav>
    <section className="help-faqs"><header><div><p>FREQUENTLY ASKED QUESTIONS</p><h2>{topic==='all'?'All help topics':scopeNames[topic]||topic}</h2></div><span>{filtered.length} answer{filtered.length===1?'':'s'}</span></header>{filtered.length?filtered.map(faq=><details key={faq.id}><summary>{faq.question}<b>＋</b></summary><p>{faq.answer}</p></details>):<div className="help-empty"><Search/><h2>No matching answer</h2><p>Try a simpler search or ask Glonni for guided help.</p></div>}</section>
    <section className="help-actions"><Link href="/support"><BotMessageSquare/><span><b>Ask Glonni</b><small>Use approved answers for normal questions.</small></span></Link><Link href="/support/requests"><Headphones/><span><b>Human support</b><small>Open and track a support request.</small></span></Link><Link href="/account?section=help"><FileText/><span><b>Legal & policies</b><small>Read Glonni’s important documents.</small></span></Link></section>
  </main></>;
}
