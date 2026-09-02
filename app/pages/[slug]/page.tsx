import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import './page.css';
export const dynamic='force-dynamic';
export default async function BuilderPage({params}:{params:Promise<{slug:string}>}){const s=await createClient();const{data:page}=await s.from('site_pages').select('id,title,description,seo_title,seo_description').eq('slug',(await params).slug).eq('status','published').maybeSingle();if(!page)notFound();const{data:blocks}=await s.from('site_page_blocks').select('*').eq('page_id',page.id).eq('is_active',true).order('display_order');return <><Header/><main className="builder-page"><header><p>GLONNI DISCOVERY</p><h1>{page.title}</h1>{page.description&&<span>{page.description}</span>}</header>{(blocks??[]).map(block=><section className={`builder-block builder-${block.block_type}`} key={block.id}>{block.image_url&&<img src={block.image_url} alt=""/>}<div><h2>{block.title}</h2>{block.body&&<p>{block.body}</p>}{block.cta_label&&block.cta_href&&<a className="primary" href={block.cta_href}>{block.cta_label}</a>}</div></section>)}</main></>}
