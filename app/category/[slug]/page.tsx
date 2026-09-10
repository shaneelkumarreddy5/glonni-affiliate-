import Link from 'next/link';
import { Store } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const descendantIds=new Set<string>([category.id]);
  let changed=true;while(changed){changed=false;for(const item of categories)if(item.parent_id&&descendantIds.has(item.parent_id)&&!descendantIds.has(item.id)){descendantIds.add(item.id);changed=true;}}
  const offers=await getCatalogOffers({categoryIds:[...descendantIds]});
  const children=categories.filter(item=>item.parent_id===category.id).sort((a,b)=>a.display_order-b.display_order);
  const parent=category.parent_id?categories.find(item=>item.id===category.parent_id):null;

  const seen = new Set<string>();
  const products = offers.filter((offer) => {
    const key = offer.products?.slug;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const storeSlugs = new Set(offers.map((offer) => offer.merchants?.slug).filter(Boolean));
  const verticalStores = stores.filter((store) => storeSlugs.has(store.slug));
  const cashbackCount = offers.filter(hasCashback).length;

  return <><Header/><main className="vertical-page">
    <BrowseNav items={[{ label: 'Categories', href: '/' }, ...(parent?[{label:parent.name,href:`/category/${parent.slug}`}]:[]), { label: category.name }]} fallback={parent?`/category/${parent.slug}`:"/"}/>
    <section className="vertical-hero">
      <div><p className="eyebrow">SHOP BY CATEGORY</p><h1>{category.name}</h1><p>Explore the brands and products currently available in this category. Compare merchant offers and see cashback only where that individual offer is eligible.</p></div>
      <aside><span><b>{products.length}</b><small>products</small></span><span><b>{verticalStores.length}</b><small>brands</small></span><span><b>{cashbackCount}</b><small>eligible offers</small></span></aside>
    </section>
    {children.length>0&&<section className="vertical-section"><div className="section-title"><div><p className="eyebrow">EXPLORE {category.name.toUpperCase()}</p><h2>Shop by subcategory</h2></div></div><div className="category-grid">{children.map(child=><Link href={`/category/${child.slug}`} key={child.id}><span className="category-icon">{child.image_url?<img src={child.image_url} alt=""/>:'›'}</span><b>{child.name}</b></Link>)}</div></section>}
    <section className="vertical-section">
      <div className="section-title"><div><p className="eyebrow">BRANDS IN {category.name.toUpperCase()}</p><h2>Shop this category by store</h2></div></div>
      {verticalStores.length ? <div className="vertical-store-grid">{verticalStores.map((store) => <Link href={`/store/${store.slug}?from=${encodeURIComponent(`/category/${category.slug}`)}`} key={store.id}><span>{store.name.slice(0, 1)}</span><div><b>{store.name}</b><small>{offers.filter((offer) => offer.merchants?.slug === store.slug).length} offers in {category.name}</small></div><Store size={17}/></Link>)}</div> : <div className="empty-state"><h2>Brands are being added</h2><p>Once a merchant has approved offers in {category.name}, it will appear here.</p></div>}
    </section>
    <section className="vertical-section">
      <div className="section-title"><div><p className="eyebrow">{category.name.toUpperCase()} PRODUCTS</p><h2>Products to compare</h2></div></div>
      {products.length ? <OfferGrid offers={products} contextHref={`/category/${category.slug}`}/> : <div className="empty-state"><h2>No products in this category yet</h2><p>Products added by the Glonni catalogue team will appear here automatically.</p><Link href="/" className="primary">Explore categories</Link></div>}
    </section>
  </main></>;
}
