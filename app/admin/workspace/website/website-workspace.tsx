'use client';

import { Fragment, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, GripVertical, ImagePlus, LayoutTemplate, Monitor, Plus, Smartphone, Tablet, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { coreSectionsByPage, insertWebsiteSection, moveWebsiteSection, websitePageOptions, type WebsiteBannerSlide, type WebsiteBlockType, type WebsiteDraftBlock, type WebsitePageKey, type WebsiteSlot } from '@/lib/website-layout';
import { publishWebsiteLayout, saveWebsiteDraft } from './actions';
import styles from './website-workspace.module.css';

export type WebsiteWorkspaceStore = { id: string; name: string; slug: string; logoUrl: string | null };
export type WebsiteWorkspaceProduct = { productId: string; offerId: string; slug: string; title: string; brand: string | null; imageUrl: string | null; categoryId: string; categoryName: string; storeSlug: string; storeName: string; price: number | null; listPrice: number | null; cashback: number | null; rating: number | null; ratingCount: number | null; updatedAt: string | null };
type CategoryOption = { id: string; name: string; slug: string; parentId: string | null };
type Device = 'desktop' | 'tablet' | 'mobile';
type Props = { initialPage: WebsitePageKey; initialLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]>; initialOrders: Record<WebsitePageKey, string[]>; publishedLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]>; publishedOrders: Record<WebsitePageKey, string[]>; pageStatuses: Partial<Record<WebsitePageKey, string>>; stores: WebsiteWorkspaceStore[]; products: WebsiteWorkspaceProduct[]; categories: CategoryOption[]; canEdit: boolean };

function newBlock(type: WebsiteBlockType, page: WebsitePageKey, storeSlug?: string): WebsiteDraftBlock {
  const slot = page === 'home' ? 'after_price_drops' : page === 'stores' ? 'store_before_products' : 'after_summary';
  const title = type === 'hero' ? 'Your featured campaign' : type === 'banner' ? 'New promotion' : type === 'store_rail' ? 'Top deals at this store' : 'Featured products';
  const config: WebsiteDraftBlock['config'] = { slot: slot as WebsiteSlot, count: 10, slide_count: type === 'hero' || type === 'banner' ? 1 : undefined, sort: 'best_deal', source_mode: 'all', banner_size: type === 'hero' || type === 'banner' ? 'wide' : undefined, accent: '#1554d1', background: '#f2f6ff' };
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

export function WebsiteWorkspace({ initialPage, initialLayouts, initialOrders, publishedLayouts: initialPublishedLayouts, publishedOrders: initialPublishedOrders, pageStatuses, stores, products, categories, canEdit }: Props) {
  const [pageKey, setPageKey] = useState<WebsitePageKey>(initialPage);
  const [layouts, setLayouts] = useState(initialLayouts);
  const [savedLayouts, setSavedLayouts] = useState(initialLayouts);
  const [publishedLayouts, setPublishedLayouts] = useState(initialPublishedLayouts);
  const [orders, setOrders] = useState(initialOrders);
  const [savedOrders, setSavedOrders] = useState(initialOrders);
  const [publishedOrders, setPublishedOrders] = useState(initialPublishedOrders);
  const [statuses, setStatuses] = useState(pageStatuses);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCoreKey, setSelectedCoreKey] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [addOpen, setAddOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState(initialOrders[initialPage]?.length ?? 0);
  const [previewStoreSlug, setPreviewStoreSlug] = useState(stores[0]?.slug ?? '');
  const [previewProductId, setPreviewProductId] = useState(products[0]?.productId ?? '');
  const [productSearch, setProductSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const blocks = layouts[pageKey] ?? [];
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const sectionOrder = orders[pageKey] ?? [];
  const coreSections = coreSectionsByPage[pageKey];
  const selectedCore = coreSections.find((section) => section.key === selectedCoreKey) ?? null;
  const dirty = JSON.stringify(blocks) !== JSON.stringify(savedLayouts[pageKey] ?? []) || JSON.stringify(sectionOrder) !== JSON.stringify(savedOrders[pageKey] ?? []);
  const hasUnpublishedDraft = JSON.stringify(savedLayouts[pageKey] ?? []) !== JSON.stringify(publishedLayouts[pageKey] ?? []) || JSON.stringify(savedOrders[pageKey] ?? []) !== JSON.stringify(publishedOrders[pageKey] ?? []);
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
  }, [products, selected, productSearch, categories]);

  function updateBlock(id: string, update: (block: WebsiteDraftBlock) => WebsiteDraftBlock) {
    setNotice(null);
    setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].map((block) => block.id === id ? update(block) : block) }));
  }

  function updateBannerSlide(blockId: string, index: number, patch: Partial<WebsiteBannerSlide>) {
    updateBlock(blockId, (block) => {
      if (index === 0) return {
        ...block,
        title: patch.title ?? block.title,
        body: patch.body ?? block.body,
        image_url: patch.image_url ?? block.image_url,
        cta_label: patch.cta_label ?? block.cta_label,
        cta_href: patch.cta_href ?? block.cta_href,
      };
      const slides = [...(block.config.slides ?? [])];
      const current = slides[index - 1] ?? { title: '', body: '', image_url: '', cta_label: '', cta_href: '' };
      slides[index - 1] = { ...current, ...patch };
      return { ...block, config: { ...block.config, slides } };
    });
  }

  function setBannerSlideCount(blockId: string, requestedCount: number) {
    const count = Math.max(1, Math.min(10, Math.round(requestedCount || 1)));
    updateBlock(blockId, (block) => {
      const slides = [...(block.config.slides ?? [])].slice(0, count - 1);
      while (slides.length < count - 1) slides.push({ title: '', body: '', image_url: '', cta_label: '', cta_href: '' });
      return { ...block, config: { ...block.config, slide_count: count, slides } };
    });
  }

  function addSection(type: WebsiteBlockType) {
    if (type === 'hero' && pageKey !== 'home') return;
    if (type === 'store_rail' && !stores.length) {
      setNotice({ kind: 'error', text: 'Add and activate a store in Stores & Brands before creating a store rail.' });
      setAddOpen(false);
      return;
    }
    const next = newBlock(type, pageKey, activeStore?.slug);
    const token = `block:${next.id}`;
    const at = Math.max(0, Math.min(insertAtIndex, sectionOrder.length));
    setLayouts((current) => ({ ...current, [pageKey]: [...current[pageKey], next] }));
    setOrders((current) => ({ ...current, [pageKey]: insertWebsiteSection(current[pageKey], token, at) }));
    setInsertAtIndex(at + 1);
    setSelectedId(next.id);
    setSelectedCoreKey(null);
    setAddOpen(false);
    setNotice(null);
  }

  function moveItem(token: string, targetIndex: number) {
    if (!canEdit) return;
    setNotice(null);
    const order = moveWebsiteSection(sectionOrder, token, targetIndex);
    if (order === sectionOrder) return;
    setOrders((current) => ({ ...current, [pageKey]: order }));
    setInsertAtIndex(order.indexOf(token) + 1);
  }

  function addAt(index: number) {
    setInsertAtIndex(index);
    setAddOpen(true);
    setSelectedId(null);
    setSelectedCoreKey(null);
  }

  async function save(publish = false) {
    if (!canEdit) {
      setNotice({ kind: 'error', text: 'Complete two-step verification with an active Owner, Admin, or Editor account before saving.' });
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const payload = { blocks, section_order: sectionOrder };
      const result = publish ? await publishWebsiteLayout(pageKey, payload) : await saveWebsiteDraft(pageKey, payload);
      if (!result.ok) setNotice({ kind: 'error', text: result.error });
      else {
        const copied = blocks.map((block) => ({ ...block, config: { ...block.config, product_ids: block.config.product_ids ? [...block.config.product_ids] : undefined, slides: block.config.slides?.map((slide) => ({ ...slide })) } }));
        setSavedLayouts((current) => ({ ...current, [pageKey]: copied }));
        setSavedOrders((current) => ({ ...current, [pageKey]: [...sectionOrder] }));
        if (publish) {
          setStatuses((current) => ({ ...current, [pageKey]: 'published' }));
          setPublishedLayouts((current) => ({ ...current, [pageKey]: copied }));
          setPublishedOrders((current) => ({ ...current, [pageKey]: [...sectionOrder] }));
        }
        setNotice({ kind: 'success', text: result.message });
      }
    } catch {
      setNotice({ kind: 'error', text: 'The request did not finish. Check your connection and try again.' });
    } finally { setBusy(false); }
  }

  async function uploadImage(field: 'image_url' | 'mobile_image_url', file?: File, slideIndex = 0) {
    if (!selected || !file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice({ kind: 'error', text: 'Choose a JPG, PNG, WebP or AVIF image up to 8 MB.' });
      return;
    }
    setUploading(slideIndex > 0 ? `slide-${slideIndex}` : field); setNotice(null);
    const extension = file.name.split('.').at(-1)?.toLowerCase() || 'jpg';
    const path = `website/${pageKey}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from('website-banners').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) {
      setNotice({ kind: 'error', text: error.message.includes('row-level security') ? 'Two-step verification is required before uploading images.' : 'The image could not be uploaded. Try again or use an HTTPS image address.' });
    } else {
      const { data } = supabase.storage.from('website-banners').getPublicUrl(path);
      if (slideIndex > 0 && field === 'image_url') updateBannerSlide(selected.id, slideIndex, { image_url: data.publicUrl });
      else updateBlock(selected.id, (block) => field === 'image_url' ? { ...block, image_url: data.publicUrl } : { ...block, config: { ...block.config, mobile_image_url: data.publicUrl } });
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
    if (block.device_visibility === 'mobile' && device !== 'mobile') return null;
    if (block.device_visibility === 'desktop' && device === 'mobile') return null;
    if (!block.is_active || (block.config.starts_at && Date.parse(block.config.starts_at) > Date.now()) || (block.config.ends_at && Date.parse(block.config.ends_at) < Date.now())) return null;
    if (block.block_type === 'hero' || block.block_type === 'banner') {
      const slides = [{ title: block.title, body: block.body, image_url: block.image_url, cta_label: block.cta_label }, ...(block.config.slides ?? [])].slice(0, Math.max(1, Math.min(10, Number(block.config.slide_count ?? 1))));
      return <div className={styles.previewBannerTrack} key={block.id}>{slides.map((slide, index) => <article key={`${block.id}-preview-${index}`} className={`${styles.previewBanner} ${styles[`size_${block.config.banner_size ?? 'wide'}`]}`} style={{ background: block.config.background ?? '#f2f6ff', borderColor: block.config.accent ?? '#1554d1' }}>
        {slide.image_url && <img src={slide.image_url} alt=""/>}<div><small>{block.block_type === 'hero' ? 'FEATURED' : 'PROMOTION'} · {index + 1}/{slides.length}</small><b>{slide.title || 'Campaign banner'}</b>{slide.body && <span>{slide.body}</span>}{slide.cta_label && <em>{slide.cta_label} ↗</em>}</div>
      </article>)}</div>;
    }
    const productsHere = blockProducts(block);
    if (!productsHere.length) return <div className={styles.previewEmpty} key={block.id}><b>{block.title || 'Product section'}</b><span>No matching active catalogue offers yet. Add an active store or choose another filter.</span></div>;
    return <section className={styles.previewRail} key={block.id}><header><div><small>{block.block_type === 'store_rail' ? `STORE DEALS · ${stores.find((store) => store.slug === block.config.store_slug)?.name ?? 'Selected store'}` : 'CURATED CATALOGUE'}</small><b>{block.title}</b></div><span>View all ↗</span></header><div className={styles.previewCards}>{productsHere.map((product) => <article key={product.productId}><img src={product.imageUrl ?? ''} alt=""/><small>{product.storeName} · {product.brand ?? product.categoryName}</small><b>{product.title}</b><strong>{money(product.price)}</strong>{product.cashback ? <em>₹{Math.round(product.cashback).toLocaleString('en-IN')} cashback</em> : null}</article>)}</div></section>;
  }

  function cataloguePreview(title: string, caption: string, kind: 'categories' | 'stores' | 'products') {
    return <section className={styles.lockedPreview}><header><div><small>CONNECTED LIVE CONTENT</small><b>{title}</b></div><span>Global card design</span></header>{kind === 'products' ? <div className={styles.fakeProducts}>{orderedOffers.slice(0, 4).map((product) => <article key={product.productId}><img src={product.imageUrl ?? ''} alt=""/><b>{product.title}</b><small>{product.storeName} · {money(product.price)}</small></article>)}</div> : kind === 'categories' ? <div className={styles.fakeCategories}>{categories.filter((category) => !category.parentId).slice(0, 7).map((category) => <span key={category.id}>{category.name}</span>)}</div> : <div className={styles.fakeStores}>{stores.slice(0, 7).map((store) => <span key={store.id}>{store.logoUrl ? <img src={store.logoUrl} alt=""/> : store.name.slice(0, 1)}{store.name}</span>)}</div>}<small>{caption}</small></section>;
  }

  function previewCore(key: string) {
    if (pageKey === 'home') {
      if (key === 'hero') return <section className={styles.defaultHero}><div><small>FEATURED DEALS</small><b>Compare before you shop.</b><span>Find the right deal across connected stores.</span><em>Explore deals →</em></div><div><small>SEASONAL PICKS</small><b>Fresh finds for every cart.</b><span>Discover products for every day.</span></div></section>;
      if (key === 'categories') return cataloguePreview('What are you shopping for?', 'Category cards keep their existing shared shape and size.', 'categories');
      if (key === 'stores') return cataloguePreview('Shop by store', 'Store cards keep their existing shared shape and size.', 'stores');
      if (key === 'best_deals') return cataloguePreview('Best deals right now', 'Product cards keep their existing shared shape and size.', 'products');
      if (key === 'trending') return cataloguePreview('Trending picks', 'Live catalogue offers in the standard product cards.', 'products');
      if (key === 'price_drops') return cataloguePreview('Worth a closer look', 'Live price-drop offers in the standard product cards.', 'products');
      return <section className={styles.coreTextPreview}><b>Glonni benefits</b><span>Trusted shopping · compare stores · eligible cashback · support</span></section>;
    }
    if (pageKey === 'stores') {
      if (key === 'store_intro') return <section className={styles.storeIntro}><small>SHOP BY STORE</small><b>{activeStore?.name ?? 'Choose a store'}</b><span>Connected store identity and current offer summary.</span><em>{orderedOffers.filter((item) => item.storeSlug === activeStore?.slug).length} available offers</em></section>;
      if (key === 'store_products') return <>{<section className={styles.lockedProductsHeader}><small>{activeStore?.name?.toUpperCase() ?? 'STORE'} PRODUCTS</small><b>Browse and compare</b><span>Search, filters and the existing product-card design stay connected.</span></section>}{cataloguePreview(`Products from ${activeStore?.name ?? 'this store'}`, 'Approved offers from this store.', 'products')}</>;
      return <section className={styles.coreTextPreview}><b>{key === 'store_policies' ? 'Store policies' : 'Store FAQs'}</b><span>Connected terms and active store-specific support answers.</span></section>;
    }
    if (key === 'product_summary') return <section className={styles.productIntro}>{activeProduct?.imageUrl && <img src={activeProduct.imageUrl} alt=""/>}<div><small>{activeProduct?.brand ?? 'GLONNI'} · {activeProduct?.categoryName ?? 'PRODUCT'}</small><b>{activeProduct?.title ?? 'Choose a product'}</b><span>Canonical product details and selected offers.</span><em>{money(activeProduct?.price ?? null)} · compare connected stores</em></div></section>;
    if (key === 'offer_comparison') return cataloguePreview('Compare prices across stores', 'Live prices, cashback and merchant offers.', 'products');
    return <section className={styles.coreTextPreview}><b>{coreSections.find((section) => section.key === key)?.title ?? key}</b><span>{coreSections.find((section) => section.key === key)?.note}</span></section>;
  }

  function previewOrderedSection(token: string) {
    if (token.startsWith('core:')) return previewCore(token.slice(5));
    const blockId = token.slice(6);
    const block = blocks.find((item) => item.id === blockId);
    return block ? previewBlock(block) : null;
  }

  const orderedItems = sectionOrder.map((token) => {
    if (token.startsWith('core:')) return { token, core: coreSections.find((section) => `core:${section.key}` === token), block: null };
    return { token, core: null, block: blocks.find((block) => `block:${block.id}` === token) ?? null };
  }).filter((item) => item.core || item.block);
  const widthClass = device === 'desktop' ? styles.desktop : device === 'tablet' ? styles.tablet : styles.mobile;
  const customerHref = pageKey === 'home' ? '/' : pageKey === 'stores' ? `/store/${activeStore?.slug ?? ''}` : `/product/${activeProduct?.slug ?? ''}`;

  return <section className={styles.workspace}>
    <div className={styles.toolbar}>
      <label className={styles.pagePicker}><LayoutTemplate/><span>Editing page</span><select value={pageKey} onChange={(event) => { const nextPage = event.target.value as WebsitePageKey; setPageKey(nextPage); setSelectedId(null); setSelectedCoreKey(null); setInsertAtIndex(orders[nextPage]?.length ?? 0); setAddOpen(false); setNotice(null); }}><option value="home">Home page</option><option value="stores">Store page</option><option value="product">Product page</option></select><ChevronDown size={15}/></label>
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
        <header><div><small>PAGE CONTENT</small><b>Sections</b><span>{orderedItems.length} sections · all movable</span></div></header>
        <div className={styles.sectionList}>
          {orderedItems.map((item, index) => <Fragment key={item.token}>
            <button className={`${styles.dropMarker} ${draggedId ? styles.dropReady : ''}`} type="button" disabled={!canEdit} onClick={() => addAt(index)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => { event.preventDefault(); const token = draggedId ?? event.dataTransfer.getData('text/plain'); if (token) moveItem(token, index); setDraggedId(null); }} aria-label={`Add a section before ${item.core?.title ?? item.block?.title ?? 'this section'}`}><i/><span>＋ Add here</span><small>Insert at this exact position</small></button>
            <article draggable={canEdit} className={`${styles.sectionCard} ${draggedId === item.token ? styles.dragging : ''} ${selectedId === item.block?.id && !selectedCoreKey || selectedCoreKey === item.core?.key ? styles.selected : ''} ${item.block && !item.block.is_active ? styles.hiddenCard : ''}`} onDragStart={(event) => { if (!canEdit) return; setDraggedId(item.token); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.token); }} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => { if (canEdit) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={(event) => { if (!canEdit) return; event.preventDefault(); event.stopPropagation(); const token = draggedId ?? event.dataTransfer.getData('text/plain'); if (token) moveItem(token, index); setDraggedId(null); }}>
              <button type="button" className={styles.dragHandle} aria-label={`Drag ${item.core?.title ?? item.block?.title ?? 'section'}`} title="Drag to move this whole section"><GripVertical/></button>
              <button type="button" className={styles.sectionSelect} onClick={() => { setSelectedId(item.block?.id ?? null); setSelectedCoreKey(item.core?.key ?? null); }}><span className={styles.sectionThumb}>{item.block ? item.block.block_type.includes('rail') ? <span className={styles.thumbCards}>▥</span> : item.block.image_url ? <img src={item.block.image_url} alt=""/> : <ImagePlus/> : <LayoutTemplate/>}</span><span><b>{item.core?.title ?? item.block?.title ?? titleForType(item.block!.block_type)}</b><small>{item.core?.note ?? `${titleForType(item.block!.block_type)} · ${item.block!.config.count ?? item.block!.config.slide_count ?? 1} ${item.block!.block_type === 'hero' || item.block!.block_type === 'banner' ? 'slides' : 'items'}`}</small></span></button>
              {item.block ? <button type="button" className={styles.miniToggle} aria-label={`${item.block.is_active ? 'Hide' : 'Show'} ${item.block.title}`} aria-pressed={item.block.is_active} onClick={() => updateBlock(item.block!.id, (current) => ({ ...current, is_active: !current.is_active }))}><i/></button> : <span className={styles.globalTag}>GLOBAL</span>}
            </article>
          </Fragment>)}
          <button className={`${styles.dropMarker} ${draggedId ? styles.dropReady : ''}`} type="button" disabled={!canEdit} onClick={() => addAt(orderedItems.length)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => { event.preventDefault(); const token = draggedId ?? event.dataTransfer.getData('text/plain'); if (token) moveItem(token, orderedItems.length); setDraggedId(null); }} aria-label="Add a section at the end of the page"><i/><span>＋ Add here</span><small>Insert at the end of the page</small></button>
        </div>
        <div className={styles.addSectionWrap}>
          {addOpen && <div className={styles.addMenu} role="menu"><button type="button" onClick={() => addSection('hero')} disabled={pageKey !== 'home'}><span>▣</span><b>Hero banner section</b><small>Add at the selected position · choose slide count</small></button><button type="button" onClick={() => addSection('banner')}><span>▱</span><b>Promotion section</b><small>Wide, strip or square · choose slide count</small></button><button type="button" onClick={() => addSection('store_rail')}><span>▥</span><b>Store deals rail</b><small>Choose a store and number of products</small></button><button type="button" onClick={() => addSection('product_rail')}><span>▤</span><b>Product collection</b><small>Choose products and display count</small></button></div>}
          <button className={styles.addSectionButton} type="button" disabled={!canEdit} onClick={() => setAddOpen((open) => !open)}><Plus/> Add section <ChevronDown size={15}/></button>
          <p>Choose “Add here” for exact placement. Drag any section by its grip to move it intactly.</p>
        </div>
      </aside>

      <section className={styles.previewStage} aria-label="Live customer page preview">
        <header className={styles.stageHeader}><div><p>LIVE CUSTOMER PAGE</p><b>{pageOption.label}{pageKey === 'stores' && activeStore ? ` · ${activeStore.name}` : pageKey === 'product' && activeProduct ? ` · ${activeProduct.title}` : ''}</b><span>Preview uses active products, prices and stores from your catalogue.</span></div><span className={styles.previewBadge}><i/>INTERACTIVE PREVIEW</span></header>
        <div className={styles.stageScroller}>
          <div className={`${styles.customerPage} ${widthClass}`}>
            <header className={styles.customerHeader}><b>Glonni</b><span>Search products, brands and stores…</span><small>Stores　 Deals　 Profile</small></header>
            {sectionOrder.map((token) => <Fragment key={token}>{previewOrderedSection(token)}</Fragment>)}
            <footer className={styles.previewFooter}>Glonni · Shop with clear offers and cashback terms</footer>
          </div>
        </div>
        <footer className={styles.stageFootnote}><span><i/>Active catalogue data</span><span>·</span><span>Changes go live only after Publish</span><span>·</span><span>{device === 'mobile' ? 'Mobile' : device === 'tablet' ? 'Tablet' : 'Desktop'} layout preview</span></footer>
      </section>

      <aside className={styles.inspector} aria-label="Section settings">
        {!selected && !selectedCore ? <div className={styles.inspectorEmpty}><LayoutTemplate/><b>Select a section to edit</b><span>Drag any section using its grip, or choose “Add here” to place a new section exactly where you want it.</span><div><b>Shared catalogue card design</b><small>Category, store and product card shapes and sizes remain consistent across the site.</small></div></div> : selectedCore ? <>
          <header className={styles.inspectorHeader}><div><small>GLOBAL SECTION · MOVABLE</small><b>{selectedCore.title}</b></div><button type="button" onClick={() => setSelectedCoreKey(null)} aria-label="Close section settings"><X/></button></header>
          <div className={styles.inspectorBody}><p className={styles.globalSectionNote}>{selectedCore.note}</p><div className={styles.globalSectionNote}><b>Position is yours to control.</b><span>Drag this section by its grip in the left list. Its catalogue data and established card shape stay intact.</span></div></div>
        </> : selected ? <>
          <header className={styles.inspectorHeader}><div><small>SECTION SETTINGS</small><b>{selected.title || titleForType(selected.block_type)}</b></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close section settings"><X/></button></header>
          <div className={styles.inspectorBody}>
            {(selected.block_type === 'hero' || selected.block_type === 'banner') ? <>
              <div className={styles.bannerSectionTitle}><b>Banner content</b><small>Shape and size apply to this section; every slide keeps its own content.</small></div>
              <label>Number of slides<input type="number" min={1} max={10} value={selected.config.slide_count ?? 1} onChange={(event) => setBannerSlideCount(selected.id, Number(event.target.value))}/></label>
              <label>Banner shape<select value={selected.config.banner_size ?? 'wide'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, banner_size: event.target.value as 'wide' | 'strip' | 'square' } }))}><option value="wide">Wide</option><option value="strip">Promotional strip</option><option value="square">Square card</option></select></label>
              {Array.from({ length: selected.config.slide_count ?? 1 }, (_, slideIndex) => {
                const extra = selected.config.slides?.[slideIndex - 1];
                const values = slideIndex === 0 ? { title: selected.title, body: selected.body, image_url: selected.image_url, cta_label: selected.cta_label, cta_href: selected.cta_href } : extra ?? { title: '', body: '', image_url: '', cta_label: '', cta_href: '' };
                return <section className={styles.slideEditor} key={`${selected.id}-slide-editor-${slideIndex}`}><header><b>Slide {slideIndex + 1}</b><small>{slideIndex === 0 ? 'First slide' : 'Additional slide'}</small></header>
                  <label>Heading<input maxLength={120} value={values.title} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { title: event.target.value })} placeholder="e.g. Diwali essentials"/></label>
                  <label>Supporting text<textarea maxLength={1800} value={values.body} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { body: event.target.value })} placeholder="Add a short customer-friendly description"/></label>
                  {slideIndex === 0 ? <label className={styles.uploadField}>Image<span className={styles.uploadRow}><input value={values.image_url} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { image_url: event.target.value })} placeholder="Paste an HTTPS image address"/><label className={styles.uploadButton}><Upload/>{uploading === 'image_url' ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('image_url', event.currentTarget.files?.[0])} disabled={Boolean(uploading)}/></label></span></label> : <label className={styles.uploadField}>Image<span className={styles.uploadRow}><input value={values.image_url} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { image_url: event.target.value })} placeholder="Paste an HTTPS image address"/><label className={styles.uploadButton}><Upload/>{uploading === `slide-${slideIndex}` ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('image_url', event.currentTarget.files?.[0], slideIndex)} disabled={Boolean(uploading)}/></label></span></label>}
                  <div className={styles.twoFields}><label>Button label<input maxLength={60} value={values.cta_label} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { cta_label: event.target.value })} placeholder="Shop now"/></label><label>Button link<input maxLength={500} value={values.cta_href} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { cta_href: event.target.value })} placeholder="/deals or https://…"/></label></div>
                </section>;
              })}
              <label className={styles.uploadField}>Mobile image for first slide (optional)<span className={styles.uploadRow}><input value={selected.config.mobile_image_url ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, mobile_image_url: event.target.value } }))} placeholder="Use a crop suited to mobile"/><label className={styles.uploadButton}><Upload/>{uploading === 'mobile_image_url' ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('mobile_image_url', event.currentTarget.files?.[0])} disabled={Boolean(uploading)}/></label></span></label>
              <div className={styles.twoFields}><label>Starts (optional)<input type="datetime-local" value={toLocalDateTime(selected.config.starts_at)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, starts_at: fromLocalDateTime(event.target.value) } }))}/></label><label>Ends (optional)<input type="datetime-local" value={toLocalDateTime(selected.config.ends_at)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, ends_at: fromLocalDateTime(event.target.value) } }))}/></label></div>
            </> : <>
              <label>Section heading<input maxLength={120} value={selected.title} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, title: event.target.value }))} placeholder="e.g. Diwali essentials"/></label>
              <label>Supporting text<textarea maxLength={1800} value={selected.body} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, body: event.target.value }))} placeholder="Add a short customer-friendly description"/></label>
            </>}
            {(selected.block_type === 'product_rail' || selected.block_type === 'store_rail') && <>
              {selected.block_type === 'store_rail' && <label>Store<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => { const previousHref = block.config.store_slug ? `/store/${block.config.store_slug}` : '/deals'; const nextSlug = event.target.value; return { ...block, cta_href: block.cta_href === previousHref || block.cta_href === '/deals' ? `/store/${nextSlug}` : block.cta_href, config: { ...block.config, store_slug: nextSlug } }; })}><option value="">Choose a connected store</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
              {selected.block_type === 'product_rail' && <>
                <label>Product source<select value={selected.config.source_mode ?? 'all'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, source_mode: event.target.value as 'all' | 'curated' } }))}><option value="all">All matching active products</option><option value="curated">Choose specific products</option></select></label>
                <label>Filter by store (optional)<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, store_slug: event.target.value || undefined } }))}><option value="">All connected stores</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>
              </>}
              <label>Filter by category (optional)<select value={selected.config.category_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, category_slug: event.target.value || undefined } }))}><option value="">All categories</option>{categories.map((category) => <option value={category.slug} key={category.id}>{formatCategory(category, categories)}</option>)}</select></label>
              <div className={styles.twoFields}><label>Number of products<input type="number" min={1} max={50} value={selected.config.count ?? 10} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, count: Math.max(1, Math.min(50, Number(event.target.value) || 1)) } }))}/></label><label>Sort by<select value={selected.config.sort ?? 'best_deal'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, sort: event.target.value as 'best_deal' | 'trending' | 'price_drop' | 'newest' } }))}><option value="best_deal">Best effective price</option><option value="trending">Top rated first</option><option value="price_drop">Highest discount first</option><option value="newest">Recently updated</option></select></label></div>
              {selected.block_type === 'product_rail' && selected.config.source_mode === 'curated' && <section className={styles.productPicker}><header><b>Choose products</b><small>{selected.config.product_ids?.length ?? 0} selected</small></header><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search active products…" aria-label="Search catalogue products"/><div>{choices.slice(0, 24).map((product) => { const ids = selected.config.product_ids ?? []; const checked = ids.includes(product.productId); return <label key={product.productId}><input type="checkbox" checked={checked} onChange={() => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, product_ids: checked ? (block.config.product_ids ?? []).filter((id) => id !== product.productId) : [...(block.config.product_ids ?? []), product.productId] } }))}/><img src={product.imageUrl ?? ''} alt=""/><span><b>{product.title}</b><small>{product.storeName} · {product.categoryName || 'Uncategorised'} · {money(product.price)}</small></span></label>; })}{!choices.length && <small className={styles.noProducts}>No active catalogue products match these filters.</small>}</div></section>}
              <small className={styles.sourceNote}><Check/> Sections show products only when their store offer is active and approved in the customer catalogue.</small>
            </>}
            {(selected.block_type === 'product_rail' || selected.block_type === 'store_rail') && <>
              <label>Button label (optional)<input maxLength={60} value={selected.cta_label} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, cta_label: event.target.value }))} placeholder="e.g. View all deals"/></label>
              {selected.cta_label && <label>Button destination<input maxLength={500} value={selected.cta_href} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, cta_href: event.target.value }))} placeholder="/deals or https://…"/></label>}
            </>}
            {pageKey === 'stores' && <label>Show on store page<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, store_slug: event.target.value || undefined } }))}><option value="">All store pages</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
            <label>Show on<select value={selected.device_visibility} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, device_visibility: event.target.value as 'all' | 'desktop' | 'mobile' }))}><option value="all">Desktop, tablet and mobile</option><option value="desktop">Desktop and tablet</option><option value="mobile">Mobile only</option></select></label>
            <div className={styles.toggleRow}><span><b>Visible to customers</b><small>Turn off to hide this section at next publish.</small></span><button type="button" className={selected.is_active ? styles.toggleOn : ''} aria-pressed={selected.is_active} onClick={() => updateBlock(selected.id, (block) => ({ ...block, is_active: !block.is_active }))}><i/></button></div>
          </div>
          <footer className={styles.inspectorFooter}><button type="button" className={styles.deleteButton} onClick={() => { setNotice(null); setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].filter((block) => block.id !== selected.id) })); setOrders((current) => ({ ...current, [pageKey]: current[pageKey].filter((token) => token !== `block:${selected.id}`) })); setSelectedId(null); }}><Trash2/> Remove section</button><span>Removes only this custom section from the draft.</span></footer>
        </> : null}
      </aside>
    </div>
    <footer className={styles.saveBar}>
      <div>{notice ? <p className={notice.kind === 'success' ? styles.success : styles.error}><i>{notice.kind === 'success' ? <Check/> : <X/>}</i>{notice.text}</p> : <p className={dirty || hasUnpublishedDraft ? styles.unsaved : styles.saved}><i>{dirty || hasUnpublishedDraft ? '!' : <Check/>}</i>{dirty ? 'Unsaved changes' : hasUnpublishedDraft ? 'Draft saved · not live' : 'All changes saved'}<small>{dirty ? 'Save draft to keep your work. Customers are not affected until you publish.' : hasUnpublishedDraft ? 'Shoppers still see the previously published layout until you publish this draft.' : 'Draft and published page are in sync.'}</small></p>}</div>
      <div className={styles.saveActions}><button type="button" className={styles.saveDraft} onClick={() => void save(false)} disabled={busy || !canEdit}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" className={styles.publish} onClick={() => void save(true)} disabled={busy || !canEdit}>{busy ? 'Publishing…' : 'Publish changes'}<ChevronRight/></button></div>
    </footer>
  </section>;
}
