import { websiteItemHref, type ResolvedWebsiteSlideItem } from '@/lib/website-layout';
import styles from './website-slide-item-cards.module.css';

function price(value: number | null) {
  return value == null ? 'Check price' : `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function WebsiteSlideItemCards({ items, compact = false }: { items: ResolvedWebsiteSlideItem[]; compact?: boolean }) {
  if (!items.length) return null;
  const previewLink = compact ? { target: '_blank', rel: 'noreferrer' } : {};
  return <div className={`${styles.items} ${compact ? styles.compact : ''}`} aria-label="Slide catalogue items">
    {items.map((item) => <article className={styles.item} key={`${item.type}-${item.id}`}>
      <a className={styles.itemHeading} href={item.href} {...previewLink}>
        <span className={styles.itemImage}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : item.name.slice(0, 1)}</span>
        <span><small>{item.type === 'store' ? 'Store' : item.type === 'category' ? 'Category / subcategory' : 'Product'}</small><strong>{item.name}</strong><em>{item.type === 'product' ? 'View product' : 'View all'} →</em></span>
      </a>
      {item.type === 'product' ? <span className={styles.price}>{price(item.products[0]?.price ?? null)}</span> : <div className={styles.products} aria-label={`Products from ${item.name}`}>
        {item.products.length ? item.products.map((product) => <a key={product.id} className={styles.product} href={websiteItemHref('product', product.slug)} title={product.title} {...previewLink}>
          {product.imageUrl ? <img src={product.imageUrl} alt=""/> : <span className={styles.productFallback}>{product.title.slice(0, 1)}</span>}
          <span><b>{product.title}</b><small>{price(product.price)}</small></span>
        </a>) : <small className={styles.empty}>No published products in this selection yet.</small>}
      </div>}
    </article>)}
  </div>;
}
