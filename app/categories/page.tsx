import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Grid2X2, Search } from 'lucide-react';
import { Header } from '@/components/header';
import { categoryBranchIds } from '@/lib/category-tree';
import { getCatalogOffers, getCategories } from '@/lib/catalog';
import styles from './categories.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop All Categories | Glonni',
  description: 'Explore Glonni categories and find current deals across connected stores.',
};

type SearchParams = Promise<{ q?: string }>;

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const search = typeof q === 'string' ? q.trim() : '';
  const [categories, offers] = await Promise.all([getCategories(), getCatalogOffers()]);
  const knownIds = new Set(categories.map((category) => category.id));
  const roots = categories.filter((category) => !category.parent_id || !knownIds.has(category.parent_id));
  const cards = roots.map((category) => {
    const branch = categoryBranchIds(categories, category.id);
    const children = categories.filter((child) => child.parent_id === category.id);
    const categoryOffers = offers.filter((offer) => offer.products?.categories?.id && branch.has(offer.products.categories.id));
    const image = category.image_url || categoryOffers.find((offer) => offer.products?.image_url)?.products?.image_url || null;
    const description = category.short_description?.trim()
      || children.slice(0, 2).map((child) => child.name).join(' · ')
      || (categoryOffers.length ? `${categoryOffers.length} ${categoryOffers.length === 1 ? 'deal' : 'deals'} to explore` : 'Explore this category');
    return { ...category, image, description, children };
  });
  const visibleCards = search
    ? cards.filter((card) => `${card.name} ${card.short_description ?? ''} ${card.description ?? ''} ${card.children.map((child) => child.name).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    : cards;

  return <><Header/><main className={styles.page}>
    <section className={styles.hero} aria-labelledby="categories-title">
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={15}/><span>Categories</span></nav>
      <div className={styles.heroCopy}><span className={styles.eyebrow}>SHOP THE WAY YOU LIKE</span><h1 id="categories-title">Explore all categories</h1><p>Find the right products and deals across Glonni.</p><a href="#all-categories" className={styles.primaryButton}>Browse categories <ArrowRight size={18}/></a></div>
    </section>

    <section className={styles.catalogue} id="all-categories" aria-labelledby="category-grid-title">
      <div className={styles.catalogueHeader}><div><span className={styles.eyebrow}>DISCOVER MORE</span><h2 id="category-grid-title">What are you shopping for?</h2></div><form className={styles.search} action="/categories" method="get" role="search"><input type="search" name="q" defaultValue={search} placeholder="Search categories..." aria-label="Search categories"/><button type="submit" aria-label="Search categories"><Search size={19}/></button></form></div>
      {visibleCards.length ? <div className={styles.grid}>{visibleCards.map((card, index) => <Link href={`/category/${card.slug}`} className={styles.card} key={card.id}><span className={`${styles.artwork} ${styles[`artwork${index % 5}`]}`}>{card.image ? <img src={card.image} alt="" loading="lazy"/> : <Grid2X2 size={40} strokeWidth={1.5} aria-hidden="true"/>}</span><span className={styles.cardName}>{card.name}</span><span className={styles.cardBottom}><span>{card.description}</span><ChevronRight size={18} aria-hidden="true"/></span></Link>)}</div> : <div className={styles.empty}><Search size={26}/><h3>No categories found</h3><p>Try a different search to see all available categories.</p><Link href="/categories">View all categories <ArrowRight size={16}/></Link></div>}
    </section>

    <aside className={styles.dealsBanner}><div><span className={styles.eyebrow}>MORE WAYS TO SAVE</span><h2>Looking for the best offers?</h2><p>Browse current deals from connected stores in one place.</p></div><Link href="/deals" className={styles.primaryButton}>Browse all deals <ArrowRight size={18}/></Link></aside>
  </main></>;
}
