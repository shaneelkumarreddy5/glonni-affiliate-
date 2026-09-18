import { createClient } from '@/lib/supabase/server';
import { systemPageSlug, type SystemPageKey } from '@/lib/system-pages';
import styles from './cms-managed-sections.module.css';

type ManagedBlock = { id:string; block_type:string; title:string|null; body:string|null; cta_label:string|null; cta_href:string|null; image_url:string|null; config:Record<string,string>|null; device_visibility:string };

export async function CmsManagedSections({pageKey,slot,className=''}:{pageKey:SystemPageKey;slot:string;className?:string}){
  const supabase=await createClient();
  // RLS exposes draft additions only to authorised content staff. Shoppers can
  // read this record only after it is published.
  const {data:page}=await supabase.from('site_pages').select('id').eq('slug',systemPageSlug(pageKey)).maybeSingle();
  if(!page)return null;
  const {data}=await supabase.from('site_page_blocks').select('id,block_type,title,body,cta_label,cta_href,image_url,config,device_visibility').eq('page_id',page.id).eq('is_active',true).order('display_order');
  const blocks=((data??[]) as ManagedBlock[]).filter(block=>(block.config?.slot??'page_end')===slot);
  if(!blocks.length)return null;
  return <div className={`${styles.wrap} ${className}`} data-cms-page={pageKey} data-cms-slot={slot}>{blocks.map(block=>{
    const accent=/^#[0-9a-f]{6}$/i.test(block.config?.accent??'')?block.config!.accent:'#1454d9';
    const background=/^#[0-9a-f]{6}$/i.test(block.config?.background??'')?block.config!.background:'#ffffff';
    return <section key={block.id} className={`${styles.block} ${styles[block.block_type]??''}`} style={{'--accent':accent,'--background':background} as React.CSSProperties} data-device={block.device_visibility}>
      <div className={styles.copy}>{block.title&&<h2>{block.title}</h2>}{block.body&&<p>{block.body}</p>}{block.cta_label&&block.cta_href&&<a href={block.cta_href}>{block.cta_label}</a>}</div>
      {block.image_url&&<img src={block.image_url} alt=""/>}
    </section>;
  })}</div>;
}
