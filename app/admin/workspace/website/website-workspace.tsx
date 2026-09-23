'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, CircleHelp, GripVertical, ImagePlus, LayoutTemplate, Monitor, Plus, Smartphone, Tablet, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slotsByPage, websitePageOptions, type WebsiteBlockType, type WebsiteDraftBlock, type WebsitePageKey, type WebsiteSlot } from '@/lib/website-layout';
import { publishWebsiteLayout, saveWebsiteDraft } from './actions';
import styles from './website-workspace.module.css';

export type WebsiteWorkspaceStore = { id: string; name: string; slug: string; logoUrl: string | null };
export type WebsiteWorkspaceProduct = { productId: string; offerId: string; slug: string; title: string; brand: string | null; imageUrl: string | null; categoryId: string; categoryName: string; storeSlug: string; storeName: string; price: number | null; listPrice: number | null; cashback: number | null; rating: number | null; ratingCount: number | null; updatedAt: string | null };
type CategoryOption = { id: string; name: string; slug: string; parentId: string | null };
type Device = 'desktop' | 'tablet' | 'mobile';
type Props = { initialPage: WebsitePageKey; initialLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]>; publishedLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]>; pageStatuses: Partial<Record<WebsitePageKey, string>>; stores: WebsiteWorkspaceStore[]; products: WebsiteWorkspaceProduct[]; categories: CategoryOption[]; canEdit: boolean };

function newBlock(type: WebsiteBlockType, page: WebsitePageKey, storeSlug?: string): WebsiteDraftBlock {
  const slot = type === 'hero' ? 'hero' : page === 'home' ? 'after_price_drops' : page === 'stores' ? 'store_before_products' : 'after_summary';
  const title = type === 'hero' ? 'Your featured campaign' : type === 'banner' ? 'New promotion' : type === 'store_rail' ? 'Top deals at this store' : 'Featured products';
  const config: WebsiteDraftBlock['config'] = { slot: slot as WebsiteSlot, count: 10, sort: 'best_deal', source_mode: 'all', banner_size: type === 'banner' ? 'wide' : undefined, accent: '#1554d1', background: '#f2f6ff' };
  if (type === 'store_rail') config.store_slug = storeSlug;
  if (page === 'stores' && storeSlug) config.store_slug = storeSlug;
  return { id: crypto.randomUUID(), block_type: type, title, body: '', cta_label: type.includes('rail') ? 'View all deals' : 'Shop now', cta_href: type === 'store_rail' && storeSlug ? `/store/${storeSlug}` : '/deals', image_url: '', config, device_visibility: 'all', is_active: true };
}

function titleForType(type: WebsiteBlockType) {
  return type === 'hero' ? 'Hero banner' : type === 'banner' ? 'Promotion banner' : type === 'store_rail' ? 'Store deals rail' : 'Product collection';
}

function money(value: number | null) { return value == null ? 'Check price' : `₹${Math.round(value).toLocaleString('en-IN')}`; }
function toLocalDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalDateTime(value: string) { return value ? new Date(value).toISOString() : ''; }

function formatCategory(category: CategoryOption, categories: CategoryOption[]) {
  const names = [category.name];
  let parent = category.parentId;
  while (parent) {
    const found = categories.find((item) => item.id === parent);
    if (!found) break;
    names.unshift(found.name);
    parent = found.parentId;
  }
  return names.join(' › ');
}

function categoryBranch(categorySlug: string | undefined, categories: CategoryOption[]) {
  if (!categorySlug) return null;
  const root = categories.find((category) => category.slug === categorySlug);
  if (!root) return new Set<string>();
  const branch = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) if (category.parentId && branch.has(category.parentId) && !branch.has(category.id)) {
      branch.add(category.id);
      changed = true;
    }
  }
  return branch;
}

export function WebsiteWorkspace({ initialPage, initialLayouts, publishedLayouts: initialPublishedLayouts, pageStatuses, stores, products, categories, canEdit }: Props) {
  const [pageKey, setPageKey] = useState<WebsitePageKey>(initialPage);
  const [layouts, setLayouts] = useState(initialLayouts);
  const [savedLayouts, setSavedLayouts] = useState(initialLayouts);
  const [publishedLayouts, setPublishedLayouts] = useState(initialPublishedLayouts);
  const [statuses, setStatuses] = useState(pageStatuses);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [addOpen, setAddOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewStoreSlug, setPreviewStoreSlug] = useState(stores[0]?.slug ?? '');
  const [previewProductId, setPreviewProductId] = useState(products[0]?.productId ?? '');
  const [productSearch, setProductSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const blocks = layouts[pageKey] ?? [];
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const dirty = JSON.stringify(blocks) !== JSON.stringify(savedLayouts[pageKey] ?? []);
  const hasUnpublishedDraft = JSON.stringify(savedLayouts[pageKey] ?? []) !== JSON.stringify(publishedLayouts[pageKey] ?? []);
  const activeStore = stores.find((store) => store.slug === previewStoreSlug) ?? stores[0];
  const activeProduct = products.find((product) => product.productId === previewProductId) ?? products[0];
  const pageOption = websitePageOptions.find((page) => page.key === pageKey)!;

  const orderedOffers = useMemo(() => {
    const byProduct = new Map<string, WebsiteWorkspaceProduct>();
    for (const product of products) {
      const current = byProduct.get(product.productId);
      const currentEffective = (current?.price ?? Infinity) - (current?.cashback ?? 0);
      const nextEffective = (product.price ?? Infinity) - (product.cashback ?? 0);
      if (!current || nextEffective < currentEffective) byProduct.set(product.productId, product);
    }
    return [...byProduct.values()];
  }, [products]);

  const choices = useMemo(() => {
    let source = products;
    if (selected?.config.store_slug) source = source.filter((product) => product.storeSlug === selected.config.store_slug);
    const categoryIds = categoryBranch(selected?.config.category_slug, categories);
    if (categoryIds) source = source.filter((product) => categoryIds.has(product.categoryId));
    const listByProduct = new Map<string, WebsiteWorkspaceProduct>();
    for (const product of source) {
      const current = listByProduct.get(product.productId);
      if (!current || ((product.price ?? Infinity) - (product.cashback ?? 0)) < ((current.price ?? Infinity) - (current.cashback ?? 0))) listByProduct.set(product.productId, product);
    }
    let list = [...listByProduct.values()];
    const search = productSearch.trim().toLowerCase();
    if (search) list = list.filter((product) => `${product.title} ${product.brand ?? ''} ${product.storeName}`.toLowerCase().includes(search));
    return list;
  }, [orderedOffers, selected, productSearch]);

  function updateBlock(id: string, update: (block: WebsiteDraftBlock) => WebsiteDraftBlock) {
    setNotice(null);
    setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].map((block) => block.id === id ? update(block) : block) }));
  }

  function addSection(type: WebsiteBlockType) {
    if (type === 'hero' && pageKey !== 'home') return;
    if (type === 'store_rail' && !stores.length) {
      setNotice({ kind: 'error', text: 'Add and activate a store in Stores & Brands before creating a store rail.' });
      setAddOpen(false);
      return;
    }
    const next = newBlock(type, pageKey, activeStore?.slug);
    setLayouts((current) => ({ ...current, [pageKey]: [...current[pageKey], next] }));
    setSelectedId(next.id);
    setAddOpen(false);
    setNotice(null);
  }

  function moveToSlot(id: string, slot: WebsiteSlot, beforeId?: string) {
    setNotice(null);
    setLayouts((current) => {
      const list = [...current[pageKey]];
      const index = list.findIndex((block) => block.id === id);
      if (index < 0) return current;
      const [moving] = list.splice(index, 1);
      const moved = { ...moving, config: { ...moving.config, slot } };
      const target = beforeId ? list.findIndex((block) => block.id === beforeId && block.config.slot === slot) : -1;
      if (target >= 0) list.splice(target, 0, moved);
      else {
        const lastInSlot = list.map((block, i) => block.config.slot === slot ? i : -1).filter((i) => i >= 0).at(-1);
        list.splice(lastInSlot == null ? list.length : lastInSlot + 1, 0, moved);
      }
      return { ...current, [pageKey]: list };
    });
  }

  function placeSelected(slot: WebsiteSlot) {
    if (selected) moveToSlot(selected.id, slot);
  }

  async function save(publish = false) {
    if (!canEdit) {
      setNotice({ kind: 'error', text: 'Complete two-step verification with an active Owner, Admin, or Editor account before saving.' });
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const result = publish ? await publishWebsiteLayout(pageKey, blocks) : await saveWebsiteDraft(pageKey, blocks);
      if (!result.ok) setNotice({ kind: 'error', text: result.error });
      else {
        setSavedLayouts((current) => ({ ...current, [pageKey]: blocks.map((block) => ({ ...block, config: { ...block.config, product_ids: block.config.product_ids ? [...block.config.product_ids] : undefined } })) }));
        if (publish) {
          setStatuses((current) => ({ ...current, [pageKey]: 'published' }));
          setPublishedLayouts((current) => ({ ...current, [pageKey]: blocks.map((block) => ({ ...block, config: { ...block.config, product_ids: block.config.product_ids ? [...block.config.product_ids] : undefined } })) }));
        }
        setNotice({ kind: 'success', text: result.message });
      }
    } catch {
      setNotice({ kind: 'error', text: 'The request did not finish. Check your connection and try again.' });
    } finally { setBusy(false); }
  }

  async function uploadImage(field: 'image_url' | 'mobile_image_url', file?: File) {
    if (!selected || !file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice({ kind: 'error', text: 'Choose a JPG, PNG, WebP or AVIF image up to 8 MB.' });
      return;
    }
    setUploading(field); setNotice(null);
    const extension = file.name.split('.').at(-1)?.toLowerCase() || 'jpg';
    const path = `website/${pageKey}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from('website-banners').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) {
      setNotice({ kind: 'error', text: error.message.includes('row-level security') ? 'Two-step verification is required before uploading images.' : 'The image could not be uploaded. Try again or use an HTTPS image address.' });
    } else {
      const { data } = supabase.storage.from('website-banners').getPublicUrl(path);
      updateBlock(selected.id, (block) => field === 'image_url' ? { ...block, image_url: data.publicUrl } : { ...block, config: { ...block.config, mobile_image_url: data.publicUrl } });
      setNotice({ kind: 'success', text: 'Image uploaded. Save or publish to use it on the customer site.' });
    }
    setUploading(null);
  }

  function blockProducts(block: WebsiteDraftBlock) {
    let source = products;
    if (block.block_type === 'store_rail' || block.config.store_slug) source = source.filter((product) => product.storeSlug === block.config.store_slug);
    const categoryIds = categoryBranch(block.config.category_slug, categories);
    if (categoryIds) source = source.filter((product) => categoryIds.has(product.categoryId));
    const curated = block.config.source_mode === 'curated';
    if (curated) {
      const index = new Map((block.config.product_ids ?? []).map((id, position) => [id, position]));
      source = source.filter((product) => index.has(product.productId)).sort((a, b) => (index.get(a.productId) ?? 99) - (index.get(b.productId) ?? 99));
    }
    const sort = block.config.sort;
    if (!curated && sort === 'trending') source = [...source].sort((a, b) => ((b.rating ?? 0) * (b.ratingCount ?? 0)) - ((a.rating ?? 0) * (a.ratingCount ?? 0)));
    else if (!curated && sort === 'price_drop') source = [...source].sort((a, b) => (((b.listPrice ?? b.price ?? 0) - (b.price ?? 0)) / Math.max(1, b.listPrice ?? b.price ?? 0)) - (((a.listPrice ?? a.price ?? 0) - (a.price ?? 0)) / Math.max(1, a.listPrice ?? a.price ?? 0)));
    else if (!curated && sort === 'newest') source = [...source].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    else if (!curated) source = [...source].sort((a, b) => ((a.price ?? Infinity) - (a.cashback ?? 0)) - ((b.price ?? Infinity) - (b.cashback ?? 0)));
    const list = new Map<string, WebsiteWorkspaceProduct>();
    for (const product of source) if (!list.has(product.productId)) list.set(product.productId, product);
    return [...list.values()].slice(0, block.config.count ?? 10);
  }

  function previewBlock(block: WebsiteDraftBlock) {
    if (!block.is_active || (block.config.starts_at && Date.parse(block.config.starts_at) > Date.now()) || (block.config.ends_at && Date.parse(block.config.ends_at) < Date.now())) return null;
    if (block.block_type === 'hero' || block.block_type === 'banner') return <article className={`${styles.previewBanner} ${styles[`size_${block.config.banner_size ?? 'wide'}`]}`} key={block.id} style={{ background: block.config.background ?? '#f2f6ff', borderColor: block.config.accent ?? '#1554d1' }}>
      {block.image_url && <img src={block.image_url} alt=""/>}<div><small>{block.block_type === 'hero' ? 'FEATURED' : 'PROMOTION'}</small><b>{block.title || 'Campaign banner'}</b>{block.body && <span>{block.body}</span>}{block.cta_label && <em>{block.cta_label} ↗</em>}</div>
    </article>;
    const productsHere = blockProducts(block);
    if (!productsHere.length) return <div className={styles.previewEmpty} key={block.id}><b>{block.title || 'Product section'}</b><span>No matching active catalogue offers yet. Add an active store or choose another filter.</span></div>;
    return <section className={styles.previewRail} key={block.id}><header><div><small>{block.block_type === 'store_rail' ? `STORE DEALS · ${stores.find((store) => store.slug === block.config.store_slug)?.name ?? 'Selected store'}` : 'CURATED CATALOGUE'}</small><b>{block.title}</b></div><span>View all ↗</span></header><div className={styles.previewCards}>{productsHere.map((product) => <article key={product.productId}><img src={product.imageUrl ?? ''} alt=""/><small>{product.storeName} · {product.brand ?? product.categoryName}</small><b>{product.title}</b><strong>{money(product.price)}</strong>{product.cashback ? <em>₹{Math.round(product.cashback).toLocaleString('en-IN')} cashback</em> : null}</article>)}</div></section>;
  }

  function customAt(slot: WebsiteSlot) {
    return blocks.filter((block) => block.config.slot === slot).map(previewBlock);
  }

  function lockedPreview(title: string, caption: string, kind: 'categories' | 'stores' | 'products') {
    return <section className={styles.lockedPreview} key={`${kind}-${title}`}><header><div><small>PROTECTED GLOBAL SECTION</small><b>{title}</b></div><span>Connected to catalogue</span></header>{kind === 'products' ? <div className={styles.fakeProducts}>{orderedOffers.slice(0, 4).map((product) => <article key={product.productId}><img src={product.imageUrl ?? ''} alt=""/><b>{product.title}</b><small>{product.storeName} · {money(product.price)}</small></article>)}</div> : kind === 'categories' ? <div className={styles.fakeCategories}>{categories.filter((category) => !category.parentId).slice(0, 7).map((category) => <span key={category.id}>{category.name}</span>)}</div> : <div className={styles.fakeStores}>{stores.slice(0, 7).map((store) => <span key={store.id}>{store.logoUrl ? <img src={store.logoUrl} alt=""/> : store.name.slice(0, 1)}{store.name}</span>)}</div>}<small>{caption}</small></section>;
  }

  const protectedAfter: Partial<Record<WebsiteSlot, string>> = pageKey === 'home'
    ? { after_hero: 'Categories · global catalogue', after_categories: 'Stores · connected merchants', after_stores: 'Best deals · approved offers', after_best_deals: 'Trending · approved offers', after_trending: 'Price drops · approved offers', before_footer: 'Footer · shared site layout' }
    : pageKey === 'stores'
      ? { store_after_intro: 'Store search and category filters · protected', store_before_products: 'Approved offers for this store · protected', page_end: 'Store policies and FAQs · connected data' }
      : { after_summary: 'Store comparison and offer details · protected', before_comparison: 'Product specifications and policies · protected' };
  const targets = slotsByPage[pageKey];
  const widthClass = device === 'desktop' ? styles.desktop : device === 'tablet' ? styles.tablet : styles.mobile;
  const customerHref = pageKey === 'home' ? '/' : pageKey === 'stores' ? `/store/${activeStore?.slug ?? ''}` : `/product/${activeProduct?.slug ?? ''}`;

  return <section className={styles.workspace}>
    <div className={styles.toolbar}>
      <label className={styles.pagePicker}><LayoutTemplate/><span>Editing page</span><select value={pageKey} onChange={(event) => { setPageKey(event.target.value as WebsitePageKey); setSelectedId(null); setNotice(null); }}><option value="home">Home page</option><option value="stores">Store page</option><option value="product">Product page</option></select><ChevronDown size={15}/></label>
      <div className={styles.devicePicker} role="group" aria-label="Preview size">
        <button className={device === 'desktop' ? styles.deviceActive : ''} onClick={() => setDevice('desktop')} title="Desktop preview" aria-pressed={device === 'desktop'}><Monitor/> <span>Desktop</span></button>
        <button className={device === 'tablet' ? styles.deviceActive : ''} onClick={() => setDevice('tablet')} title="Tablet preview" aria-pressed={device === 'tablet'}><Tablet/> <span>Tablet</span></button>
        <button className={device === 'mobile' ? styles.deviceActive : ''} onClick={() => setDevice('mobile')} title="Mobile preview" aria-pressed={device === 'mobile'}><Smartphone/> <span>Mobile</span></button>
      </div>
      {pageKey === 'stores' && <label className={styles.contextPicker}>Preview store<select value={previewStoreSlug} onChange={(event) => setPreviewStoreSlug(event.target.value)}>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
      {pageKey === 'product' && <label className={styles.contextPicker}>Preview product<select value={previewProductId} onChange={(event) => setPreviewProductId(event.target.value)}>{orderedOffers.map((product) => <option value={product.productId} key={product.productId}>{product.title}</option>)}</select></label>}
      <div className={styles.topActions}><span className={`${styles.statusChip} ${statuses[pageKey] === 'published' && !hasUnpublishedDraft && !dirty ? styles.live : ''}`}><i/>{dirty ? 'Unsaved edits' : hasUnpublishedDraft ? 'Draft saved · not live' : statuses[pageKey] === 'published' ? 'Live page' : 'Draft only'}</span><a href={customerHref} target="_blank" rel="noreferrer">Open page ↗</a></div>
    </div>

    <div className={styles.editorGrid}>
      <aside className={styles.sectionSidebar} aria-label="Page sections">
        <header><div><small>PAGE CONTENT</small><b>Sections</b><span>{blocks.length} custom section{blocks.length === 1 ? '' : 's'}</span></div><span title="Global sections stay protected. Add your own content, then drop it at a marked position."><CircleHelp aria-hidden="true"/></span></header>
        <div className={styles.sectionList}>
          {targets.map((slot, index) => {
            const inSlot = blocks.filter((block) => block.config.slot === slot.key);
            return <div className={styles.slotGroup} key={slot.key} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedId) moveToSlot(draggedId, slot.key); setDraggedId(null); }}>
              {index === 0 && pageKey === 'stores' && <div className={styles.globalSection}><span className={styles.lockIcon}>▣</span><div><b>Store identity and summary</b><small>Connected store data · protected</small></div><span className={styles.lockBadge}>LOCKED</span></div>}
              {index === 0 && pageKey === 'product' && <div className={styles.globalSection}><span className={styles.lockIcon}>▣</span><div><b>Product identity and variants</b><small>Catalogue data · protected</small></div><span className={styles.lockBadge}>LOCKED</span></div>}
              <button className={`${styles.dropMarker} ${draggedId ? styles.dropReady : ''}`} type="button" disabled={!selected && !draggedId} onClick={() => placeSelected(slot.key)} aria-label={`Place selected section at ${slot.label}`}><i/><span>{slot.label}</span><small>{draggedId ? 'Drop here' : selected ? 'Place selected section here' : 'Drag a section here'}</small></button>
              {inSlot.map((block) => <article key={block.id} draggable onDragStart={() => setDraggedId(block.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (draggedId && draggedId !== block.id) moveToSlot(draggedId, slot.key, block.id); setDraggedId(null); }} className={`${styles.sectionCard} ${selectedId === block.id ? styles.selected : ''} ${!block.is_active ? styles.hiddenCard : ''}`}>
                <button type="button" className={styles.dragHandle} aria-label={`Drag ${block.title} section`} title="Drag to another position"><GripVertical/></button>
                <button type="button" className={styles.sectionSelect} onClick={() => setSelectedId(block.id)}><span className={styles.sectionThumb}>{block.block_type.includes('rail') ? <span className={styles.thumbCards}>▥</span> : block.image_url ? <img src={block.image_url} alt=""/> : <ImagePlus/>}</span><span><b>{block.title || titleForType(block.block_type)}</b><small>{titleForType(block.block_type)} · {slot.label}</small></span></button>
                <button type="button" className={styles.miniToggle} aria-label={`${block.is_active ? 'Hide' : 'Show'} ${block.title}`} aria-pressed={block.is_active} onClick={() => updateBlock(block.id, (current) => ({ ...current, is_active: !current.is_active }))}><i/></button>
              </article>)}
              {protectedAfter[slot.key] && <div className={styles.globalSection}><span className={styles.lockIcon}>▥</span><div><b>{protectedAfter[slot.key]?.split(' · ')[0]}</b><small>{protectedAfter[slot.key]?.split(' · ').slice(1).join(' · ')}</small></div><span className={styles.lockBadge}>LOCKED</span></div>}
            </div>;
          })}
        </div>
        <div className={styles.addSectionWrap}>
          {addOpen && <div className={styles.addMenu} role="menu"><button type="button" onClick={() => addSection('hero')} disabled={pageKey !== 'home'}><span>▣</span><b>Hero banner</b><small>Large campaign image</small></button><button type="button" onClick={() => addSection('banner')}><span>▱</span><b>Promotion banner</b><small>Wide, strip or square</small></button><button type="button" onClick={() => addSection('store_rail')}><span>▥</span><b>Store deals rail</b><small>Choose one connected store</small></button><button type="button" onClick={() => addSection('product_rail')}><span>▤</span><b>Product collection</b><small>Choose store, category or products</small></button></div>}
          <button className={styles.addSectionButton} type="button" disabled={!canEdit} onClick={() => setAddOpen((open) => !open)}><Plus/> Add section <ChevronDown size={15}/></button>
          <p>Core page sections are protected and still use their live catalogue data.</p>
        </div>
      </aside>

      <section className={styles.previewStage} aria-label="Live customer page preview">
        <header className={styles.stageHeader}><div><p>LIVE CUSTOMER PAGE</p><b>{pageOption.label}{pageKey === 'stores' && activeStore ? ` · ${activeStore.name}` : pageKey === 'product' && activeProduct ? ` · ${activeProduct.title}` : ''}</b><span>Preview uses active products, prices and stores from your catalogue.</span></div><span className={styles.previewBadge}><i/>INTERACTIVE PREVIEW</span></header>
        <div className={styles.stageScroller}>
          <div className={`${styles.customerPage} ${widthClass}`}>
            <header className={styles.customerHeader}><b>Glonni</b><span>Search products, brands and stores…</span><small>Stores　 Deals　 Profile</small></header>
            {pageKey === 'home' ? <>
              {blocks.some((block) => block.config.slot === 'hero' && block.is_active) ? customAt('hero') : <section className={styles.defaultHero}><div><small>FEATURED DEALS</small><b>Compare before you shop.</b><span>Find the right deal across connected stores.</span><em>Explore deals →</em></div><div><small>SEASONAL PICKS</small><b>Fresh finds for every cart.</b><span>Discover products for every day.</span></div></section>}
              {customAt('after_hero')}
              {lockedPreview('What are you shopping for?', 'Categories are global and managed in the catalogue.', 'categories')}
              {customAt('after_categories')}
              {lockedPreview('Shop by store', 'Connected merchants only.', 'stores')}
              {customAt('after_stores')}
              {lockedPreview('Best deals right now', 'Approved offers and cashback only.', 'products')}
              {customAt('after_best_deals')}
              {lockedPreview('Trending picks', 'Live catalogue products, never manual demo cards.', 'products')}
              {customAt('after_trending')}
              {lockedPreview('Worth a closer look', 'Current offers from connected stores.', 'products')}
              {customAt('after_price_drops')}{customAt('before_footer')}
            </> : pageKey === 'stores' ? <>
              <section className={styles.storeIntro}><small>SHOP BY STORE</small><b>{activeStore?.name ?? 'Choose a store'}</b><span>Products and deals available from this connected merchant.</span><em>{orderedOffers.filter((item) => item.storeSlug === activeStore?.slug).length} available offers</em></section>
              {customAt('store_after_intro')}
              <section className={styles.lockedProductsHeader}><small>{activeStore?.name?.toUpperCase() ?? 'STORE'} PRODUCTS</small><b>Browse and compare</b><span>Search and filters · managed globally</span></section>
              {customAt('store_before_products')}
              {lockedPreview(`Products from ${activeStore?.name ?? 'this store'}`, 'Customer sees eligible, active offers from this store.', 'products')}
              {customAt('page_end')}
            </> : <>
              <section className={styles.productIntro}>{activeProduct?.imageUrl && <img src={activeProduct.imageUrl} alt=""/>}<div><small>{activeProduct?.brand ?? 'GLONNI'} · {activeProduct?.categoryName ?? 'PRODUCT'}</small><b>{activeProduct?.title ?? 'Choose a product'}</b><span>Product data and store offers remain connected to the catalogue.</span><em>{money(activeProduct?.price ?? null)} · compare connected stores</em></div></section>
              {customAt('after_summary')}
              <section className={styles.lockedProductsHeader}><small>COMPARE OFFERS</small><b>Available stores and cashback</b><span>Prices and merchant offers · protected</span></section>
              {customAt('before_comparison')}
              {lockedPreview('Store comparison', 'Offer details and merchant redirects are managed globally.', 'products')}
              {customAt('page_end')}
            </>}
            <footer className={styles.previewFooter}>Glonni · Shop with clear offers and cashback terms</footer>
          </div>
        </div>
        <footer className={styles.stageFootnote}><span><i/>Active catalogue data</span><span>·</span><span>Changes go live only after Publish</span><span>·</span><span>{device === 'mobile' ? 'Mobile' : device === 'tablet' ? 'Tablet' : 'Desktop'} layout preview</span></footer>
      </section>

      <aside className={styles.inspector} aria-label="Section settings">
        {!selected ? <div className={styles.inspectorEmpty}><LayoutTemplate/><b>Select a section to edit</b><span>Add a banner or catalogue rail from the left. Drag it to the position you want in the page, then use its settings here.</span><div><b>Real catalogue data stays protected</b><small>Categories, product cards, store directory and offer details are not overwritten by this workspace.</small></div></div> : <>
          <header className={styles.inspectorHeader}><div><small>SECTION SETTINGS</small><b>{selected.title || titleForType(selected.block_type)}</b></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close section settings"><X/></button></header>
          <div className={styles.inspectorBody}>
            <label>Section heading<input maxLength={120} value={selected.title} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, title: event.target.value }))} placeholder="e.g. Diwali essentials"/></label>
            <label>Supporting text<textarea maxLength={1800} value={selected.body} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, body: event.target.value }))} placeholder="Add a short customer-friendly description"/></label>
            {(selected.block_type === 'hero' || selected.block_type === 'banner') && <>
              <label>Banner shape<select value={selected.config.banner_size ?? 'wide'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, banner_size: event.target.value as 'wide' | 'strip' | 'square' } }))}><option value="wide">Wide hero</option><option value="strip">Slim promotional strip</option><option value="square">Square promotion</option></select></label>
              <label className={styles.uploadField}>Desktop / main image<span className={styles.uploadRow}><input value={selected.image_url} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, image_url: event.target.value }))} placeholder="Paste an HTTPS image address"/><label className={styles.uploadButton}><Upload/>{uploading === 'image_url' ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('image_url', event.currentTarget.files?.[0])} disabled={Boolean(uploading)}/></label></span></label>
              <label className={styles.uploadField}>Mobile image (optional)<span className={styles.uploadRow}><input value={selected.config.mobile_image_url ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, mobile_image_url: event.target.value } }))} placeholder="Use a crop suited to mobile"/><label className={styles.uploadButton}><Upload/>{uploading === 'mobile_image_url' ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('mobile_image_url', event.currentTarget.files?.[0])} disabled={Boolean(uploading)}/></label></span></label>
              <div className={styles.twoFields}><label>Starts (optional)<input type="datetime-local" value={toLocalDateTime(selected.config.starts_at)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, starts_at: fromLocalDateTime(event.target.value) } }))}/></label><label>Ends (optional)<input type="datetime-local" value={toLocalDateTime(selected.config.ends_at)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, ends_at: fromLocalDateTime(event.target.value) } }))}/></label></div>
            </>}
            {(selected.block_type === 'product_rail' || selected.block_type === 'store_rail') && <>
              {selected.block_type === 'store_rail' && <label>Store<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => { const previousHref = block.config.store_slug ? `/store/${block.config.store_slug}` : '/deals'; const nextSlug = event.target.value; return { ...block, cta_href: block.cta_href === previousHref || block.cta_href === '/deals' ? `/store/${nextSlug}` : block.cta_href, config: { ...block.config, store_slug: nextSlug } }; })}><option value="">Choose a connected store</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
              {selected.block_type === 'product_rail' && <>
                <label>Product source<select value={selected.config.source_mode ?? 'all'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, source_mode: event.target.value as 'all' | 'curated' } }))}><option value="all">All matching active products</option><option value="curated">Choose specific products</option></select></label>
                <label>Filter by store (optional)<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, store_slug: event.target.value || undefined } }))}><option value="">All connected stores</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>
              </>}
              <label>Filter by category (optional)<select value={selected.config.category_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, category_slug: event.target.value || undefined } }))}><option value="">All categories</option>{categories.map((category) => <option value={category.slug} key={category.id}>{formatCategory(category, categories)}</option>)}</select></label>
              <div className={styles.twoFields}><label>Maximum products<input type="number" min={1} max={50} value={selected.config.count ?? 10} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, count: Number(event.target.value) } }))}/></label><label>Sort by<select value={selected.config.sort ?? 'best_deal'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, sort: event.target.value as 'best_deal' | 'trending' | 'price_drop' | 'newest' } }))}><option value="best_deal">Best effective price</option><option value="trending">Top rated first</option><option value="price_drop">Highest discount first</option><option value="newest">Recently updated</option></select></label></div>
              {selected.block_type === 'product_rail' && selected.config.source_mode === 'curated' && <section className={styles.productPicker}><header><b>Choose products</b><small>{selected.config.product_ids?.length ?? 0} selected</small></header><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search active products…" aria-label="Search catalogue products"/><div>{choices.slice(0, 24).map((product) => { const ids = selected.config.product_ids ?? []; const checked = ids.includes(product.productId); return <label key={product.productId}><input type="checkbox" checked={checked} onChange={() => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, product_ids: checked ? (block.config.product_ids ?? []).filter((id) => id !== product.productId) : [...(block.config.product_ids ?? []), product.productId] } }))}/><img src={product.imageUrl ?? ''} alt=""/><span><b>{product.title}</b><small>{product.storeName} · {product.categoryName || 'Uncategorised'} · {money(product.price)}</small></span></label>; })}{!choices.length && <small className={styles.noProducts}>No active catalogue products match these filters.</small>}</div></section>}
              <small className={styles.sourceNote}><Check/> Sections show products only when their store offer is active and approved in the customer catalogue.</small>
            </>}
            <label>Button label (optional)<input maxLength={60} value={selected.cta_label} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, cta_label: event.target.value }))} placeholder="e.g. View all deals"/></label>
            {selected.cta_label && <label>Button destination<input maxLength={500} value={selected.cta_href} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, cta_href: event.target.value }))} placeholder="/deals or https://…"/></label>}
            {pageKey === 'stores' && <label>Show on store page<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, store_slug: event.target.value || undefined } }))}><option value="">All store pages</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
            <label>Place section<select value={selected.config.slot ?? targets[0].key} onChange={(event) => moveToSlot(selected.id, event.target.value as WebsiteSlot)}>{targets.map((slot) => <option value={slot.key} key={slot.key}>{slot.label}</option>)}</select></label>
            <label>Show on<select value={selected.device_visibility} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, device_visibility: event.target.value as 'all' | 'desktop' | 'mobile' }))}><option value="all">Desktop, tablet and mobile</option><option value="desktop">Desktop and tablet</option><option value="mobile">Mobile only</option></select></label>
            <div className={styles.toggleRow}><span><b>Visible to customers</b><small>Turn off to hide this section at next publish.</small></span><button type="button" className={selected.is_active ? styles.toggleOn : ''} aria-pressed={selected.is_active} onClick={() => updateBlock(selected.id, (block) => ({ ...block, is_active: !block.is_active }))}><i/></button></div>
          </div>
          <footer className={styles.inspectorFooter}><button type="button" className={styles.deleteButton} onClick={() => { setNotice(null); setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].filter((block) => block.id !== selected.id) })); setSelectedId(null); }}><Trash2/> Remove section</button><span>Removes only this custom section from the draft.</span></footer>
        </>}
      </aside>
    </div>
    <footer className={styles.saveBar}>
      <div>{notice ? <p className={notice.kind === 'success' ? styles.success : styles.error}><i>{notice.kind === 'success' ? <Check/> : <X/>}</i>{notice.text}</p> : <p className={dirty || hasUnpublishedDraft ? styles.unsaved : styles.saved}><i>{dirty || hasUnpublishedDraft ? '!' : <Check/>}</i>{dirty ? 'Unsaved changes' : hasUnpublishedDraft ? 'Draft saved · not live' : 'All changes saved'}<small>{dirty ? 'Save draft to keep your work. Customers are not affected until you publish.' : hasUnpublishedDraft ? 'Shoppers still see the previously published layout until you publish this draft.' : 'Draft and published page are in sync.'}</small></p>}</div>
      <div className={styles.saveActions}><button type="button" className={styles.saveDraft} onClick={() => void save(false)} disabled={busy || !canEdit}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" className={styles.publish} onClick={() => void save(true)} disabled={busy || !canEdit}>{busy ? 'Publishing…' : 'Publish changes'}<ChevronRight/></button></div>
    </footer>
  </section>;
}
