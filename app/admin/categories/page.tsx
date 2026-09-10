import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { CheckCircle2, Download, Upload } from 'lucide-react';
import { importCategories } from '../actions';
import { CategoryTreeManager, TreeCategory } from './category-tree-manager';

export const dynamic='force-dynamic';
type Params={success?:string;tab?:string};
type CategoryRow=Omit<TreeCategory,'products'|'children_count'>;

export default async function CategoriesPage({searchParams}:{searchParams:Promise<Params>}){
  const query=await searchParams,s=await createClient();
  const [{data:categoryData},{data:products}]=await Promise.all([
    s.from('categories').select('id,name,slug,parent_id,level,description,image_url,icon_name,seo_title,seo_description,show_on_homepage,display_order,is_active,archived_at').order('display_order'),
    s.from('products').select('category_id'),
  ]);
  const rows=(categoryData??[]) as CategoryRow[],productRows=products??[];
  const categories:TreeCategory[]=rows.map(c=>({...c,products:productRows.filter(p=>p.category_id===c.id).length,children_count:rows.filter(x=>x.parent_id===c.id).length}));
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content category-admin-page">
    <div className="admin-title category-tree-title"><div><p>CATALOGUE TAXONOMY</p><h1>Categories</h1><span>Manage every parent and child category in one clear hierarchical tree.</span></div></div>
    {query.success&&<p className="admin-success"><CheckCircle2/>{query.success}</p>}
    {query.tab==='import'?<section className="category-import-page"><nav><Link href="/admin/categories">← Back to category tree</Link></nav><article><Upload/><div><h2>Import category CSV</h2><p>Upload up to 500 rows. Use parent_slug to place each category anywhere in the tree.</p><code>name, parent_slug, description</code></div><form action={importCategories}><input name="file" type="file" accept=".csv,text/csv" required/><button>Import drafts</button></form></article><article><Download/><div><h2>Export category tree</h2><p>Download the complete hierarchy, status, order and SEO data.</p></div><Link href="/admin/categories/export">Download CSV</Link></article></section>:<CategoryTreeManager categories={categories}/>}
  </main></section></main>;
}
