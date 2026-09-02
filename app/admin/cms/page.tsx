import { AdminSidebar } from '@/components/admin-sidebar';
import { WebsiteBuilder } from '@/components/website-builder';
import { createClient } from '@/lib/supabase/server';
import './website-builder.css';

export const dynamic = 'force-dynamic';

export default async function CmsPage() {
  const supabase = await createClient();
  const [{ data: pages }, { data: blocks }, { data: popups }] = await Promise.all([
    supabase.from('site_pages').select('id,title,slug,description,status,device_visibility,updated_at').order('updated_at', { ascending: false }),
    supabase.from('site_page_blocks').select('id,page_id,block_type,title,body,cta_label,cta_href,image_url,config,display_order,device_visibility,is_active').order('display_order'),
    supabase.from('site_popups').select('id,name,title,status,trigger_type,target_scope,updated_at').order('updated_at', { ascending: false }),
  ]);
  return <main className="admin-v2 website-builder-shell"><AdminSidebar/><section className="admin-main"><WebsiteBuilder pages={pages ?? []} blocks={blocks ?? []} popups={popups ?? []}/></section></main>;
}
