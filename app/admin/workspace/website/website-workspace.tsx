'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import { Bold, Check, ChevronDown, ChevronRight, ExternalLink, GripVertical, ImagePlus, Italic, LayoutTemplate, Monitor, Plus, Smartphone, Tablet, Trash2, Underline, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { renderWebsiteRichText } from '@/lib/website-rich-text';
import { coreSectionsByPage, insertWebsiteSection, moveWebsiteSection, removeWebsiteBannerSlide, websiteItemHref, websitePageOptions, type WebsiteBannerSlide, type WebsiteBlockType, type WebsiteCoreContent, type WebsiteDraftBlock, type WebsitePageKey, type WebsiteSlideTarget, type WebsiteSlot, type WebsiteVisualShape } from '@/lib/website-layout';
import { publishWebsiteLayout, saveWebsiteDraft } from './actions';
import styles from './website-workspace.module.css';

export type WebsiteWorkspaceStore = { id: string; name: string; slug: string; logoUrl: string | null };
export type WebsiteWorkspaceProduct = { productId: string; offerId: string; slug: string; title: string; brand: string | null; imageUrl: string | null; categoryId: string; categoryName: string; storeSlug: string; storeName: string; price: number | null; listPrice: number | null; cashback: number | null; rating: number | null; ratingCount: number | null; updatedAt: string | null };
type CategoryOption = { id: string; name: string; slug: string; parentId: string | null; imageUrl?: string | null };
type Device = 'desktop' | 'tablet' | 'mobile';
type CoreContentMap = Record<WebsitePageKey, Record<string, WebsiteCoreContent>>;
type Props = { initialPage: WebsitePageKey; initialLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]>; initialOrders: Record<WebsitePageKey, string[]>; initialCoreContent: CoreContentMap; publishedLayouts: Record<WebsitePageKey, WebsiteDraftBlock[]>; publishedOrders: Record<WebsitePageKey, string[]>; publishedCoreContent: CoreContentMap; pageStatuses: Partial<Record<WebsitePageKey, string>>; stores: WebsiteWorkspaceStore[]; products: WebsiteWorkspaceProduct[]; categories: CategoryOption[]; canEdit: boolean };

function RichTextField({ value, onChange, placeholder, maxLength = 1800 }: { value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number }) {
  const input = useRef<HTMLTextAreaElement>(null);
  function wrap(open: string, close: string) {
    const element = input.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${open}${selected}${close}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + open.length, start + open.length + selected.length);
    });
  }
  return <div className={styles.richEditor}>
    <div className={styles.richToolbar} aria-label="Text formatting">
      <button type="button" title="Bold" aria-label="Bold selected text" onMouseDown={(event) => event.preventDefault()} onClick={() => wrap('**', '**')}><Bold/></button>
      <button type="button" title="Italic" aria-label="Italic selected text" onMouseDown={(event) => event.preventDefault()} onClick={() => wrap('*', '*')}><Italic/></button>
      <button type="button" title="Underline" aria-label="Underline selected text" onMouseDown={(event) => event.preventDefault()} onClick={() => wrap('__', '__')}><Underline/></button>
      <label title="Text color" aria-label="Choose text color"><span>A</span><input type="color" defaultValue="#1554d1" onChange={(event) => wrap(`[color=${event.target.value}]`, '[/color]')}/></label>
      <small>Select text, then choose a style.</small>
    </div>
    <textarea ref={input} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/>
  </div>;
}

type PickerItem = { id: string; label: string; detail?: string; image?: string | null };
function CataloguePicker({ title, items, selectedIds, search, onSearch, onToggle }: { title: string; items: PickerItem[]; selectedIds: string[]; search: string; onSearch: (value: string) => void; onToggle: (id: string) => void }) {
  return <details className={styles.productPicker}>
    <summary><b>{title}</b><small>{selectedIds.length} selected</small></summary>
    <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title.toLowerCase()}`}/>
    <div>{items.slice(0, 60).map((item) => <label key={item.id}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)}/>{item.image ? <img src={item.image} alt=""/> : <span className={styles.pickerLetter}>{item.label.slice(0, 1)}</span>}<span><b>{item.label}</b><small>{item.detail}</small></span></label>)}{!items.length && <small className={styles.noProducts}>No catalogue items match this search.</small>}</div>
  </details>;
}

function SlideItemPicker({ title, items, selectedId, name, onSelect }: { title: string; items: PickerItem[]; selectedId?: string; name: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const selected = items.find((item) => item.id === selectedId);
  const matches = items.filter((item) => `${item.label} ${item.detail ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <details className={`${styles.productPicker} ${styles.slideItemPicker}`}>
    <summary><b>{title}</b><small>{selected?.label ?? 'Choose one'}</small></summary>
    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title.toLowerCase()}`}/>
    <div>{matches.slice(0, 60).map((item) => <label key={item.id}><input type="radio" name={name} checked={item.id === selectedId} onChange={() => onSelect(item.id)}/>{item.image ? <img src={item.image} alt=""/> : <span className={styles.pickerLetter}>{item.label.slice(0, 1)}</span>}<span><b>{item.label}</b><small>{item.detail}</small></span></label>)}{!matches.length && <small className={styles.noProducts}>No matching catalogue items.</small>}</div>
  </details>;
}

function newBlock(type: WebsiteBlockType, page: WebsitePageKey, storeSlug?: string): WebsiteDraftBlock {
  const slot = page === 'home' ? 'after_price_drops' : page === 'stores' ? 'store_before_products' : 'after_summary';
  const title = type === 'hero' ? 'Your featured campaign' : type === 'banner' ? 'New promotion' : type === 'store_rail' ? 'Top deals at this store' : type === 'category_rail' ? 'Browse categories' : type === 'store_directory' ? 'Shop by store' : 'Featured products';
  const config: WebsiteDraftBlock['config'] = { slot: slot as WebsiteSlot, count: 10, slide_count: type === 'hero' || type === 'banner' ? 1 : undefined, slide_targets: type === 'hero' || type === 'banner' ? [{ type: 'manual' }] : undefined, sort: 'best_deal', source_mode: type === 'product_rail' ? 'curated' : 'all', product_ids: [], banner_size: type === 'hero' || type === 'banner' ? 'wide' : undefined, visual_shape: 'standard', accent: '#1554d1', background: '#f2f6ff' };
  if (type === 'store_rail') config.store_slug = storeSlug;
  if (page === 'stores' && storeSlug) config.store_slug = storeSlug;
  return { id: crypto.randomUUID(), block_type: type, title, body: '', cta_label: type.includes('rail') ? 'View all deals' : 'Shop now', cta_href: type === 'store_rail' && storeSlug ? `/store/${storeSlug}` : '/deals', image_url: '', config, device_visibility: 'all', is_active: true };
}

function titleForType(type: WebsiteBlockType) {
  return type === 'hero' ? 'Hero banner' : type === 'banner' ? 'Promotion banner' : type === 'store_rail' ? 'Store deals rail' : type === 'category_rail' ? 'Category cards' : type === 'store_directory' ? 'Store cards' : 'Product collection';
}

function money(value: number | null) { return value == null ? 'Check price' : `₹${Math.round(value).toLocaleString('en-IN')}`; }
function renderRichPreview(value: string) { return <>{renderWebsiteRichText(value)}</>; }
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

export function WebsiteWorkspace({ initialPage, initialLayouts, initialOrders, initialCoreContent, publishedLayouts: initialPublishedLayouts, publishedOrders: initialPublishedOrders, publishedCoreContent: initialPublishedCoreContent, pageStatuses, stores, products, categories, canEdit }: Props) {
  const [pageKey, setPageKey] = useState<WebsitePageKey>(initialPage);
  const [layouts, setLayouts] = useState(initialLayouts);
  const [savedLayouts, setSavedLayouts] = useState(initialLayouts);
  const [publishedLayouts, setPublishedLayouts] = useState(initialPublishedLayouts);
  const [orders, setOrders] = useState(initialOrders);
  const [savedOrders, setSavedOrders] = useState(initialOrders);
  const [publishedOrders, setPublishedOrders] = useState(initialPublishedOrders);
  const [coreContent, setCoreContent] = useState(initialCoreContent);
  const [savedCoreContent, setSavedCoreContent] = useState(initialCoreContent);
  const [publishedCoreContent, setPublishedCoreContent] = useState(initialPublishedCoreContent);
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
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const blocks = layouts[pageKey] ?? [];
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const sectionOrder = orders[pageKey] ?? [];
  const coreSections = coreSectionsByPage[pageKey];
  const selectedCore = coreSections.find((section) => section.key === selectedCoreKey) ?? null;
  const currentCoreContent = coreContent[pageKey] ?? {};
  const dirty = JSON.stringify(blocks) !== JSON.stringify(savedLayouts[pageKey] ?? []) || JSON.stringify(sectionOrder) !== JSON.stringify(savedOrders[pageKey] ?? []) || JSON.stringify(currentCoreContent) !== JSON.stringify(savedCoreContent[pageKey] ?? {});
  const hasUnpublishedDraft = JSON.stringify(savedLayouts[pageKey] ?? []) !== JSON.stringify(publishedLayouts[pageKey] ?? []) || JSON.stringify(savedOrders[pageKey] ?? []) !== JSON.stringify(publishedOrders[pageKey] ?? []) || JSON.stringify(savedCoreContent[pageKey] ?? {}) !== JSON.stringify(publishedCoreContent[pageKey] ?? {});
  const activeStore = stores.find((store) => store.slug === previewStoreSlug) ?? stores[0];
  const activeProduct = products.find((product) => product.productId === previewProductId) ?? products[0];
  const pageOption = websitePageOptions.find((page) => page.key === pageKey)!;
  function updateCoreContent(key: string, patch: Partial<WebsiteCoreContent>) {
    setNotice(null);
    setCoreContent((current) => ({ ...current, [pageKey]: { ...current[pageKey], [key]: { ...(current[pageKey]?.[key] ?? {}), ...patch } } }));
  }
  function toggleCorePick(key: string, field: 'product_ids' | 'category_ids' | 'store_ids', id: string) {
    const values = currentCoreContent[key]?.[field] ?? [];
    updateCoreContent(key, { [field]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id] });
  }
  function removeCoreSection(key: string) {
    setOrders((current) => ({ ...current, [pageKey]: (current[pageKey] ?? []).filter((token) => token !== `core:${key}`) }));
    setCoreContent((current) => { const next = { ...current[pageKey] }; delete next[key]; return { ...current, [pageKey]: next }; });
    setSelectedCoreKey(null);
    setCatalogueSearch('');
    setNotice(null);
  }

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

  const coreProductChoices = useMemo(() => {
    const search = catalogueSearch.trim().toLowerCase();
    const unique = new Map<string, WebsiteWorkspaceProduct>();
    for (const product of orderedOffers) if (!search || `${product.title} ${product.brand ?? ''} ${product.storeName}`.toLowerCase().includes(search)) unique.set(product.productId, product);
    return [...unique.values()];
  }, [orderedOffers, catalogueSearch]);
  const matchingCategoryChoices = categories.filter((category) => formatCategory(category, categories).toLowerCase().includes(catalogueSearch.trim().toLowerCase())).map((category) => ({ id: category.id, label: formatCategory(category, categories), detail: category.parentId ? 'Subcategory · opens its own category page' : 'Main category · opens its own category page', image: category.imageUrl }));
  const matchingStoreChoices = stores.filter((store) => store.name.toLowerCase().includes(catalogueSearch.trim().toLowerCase())).map((store) => ({ id: store.id, label: store.name, detail: `Store page: /store/${store.slug}`, image: store.logoUrl }));
  const matchingCoreProductChoices = coreProductChoices.map((product) => ({ id: product.productId, label: product.title, detail: `${product.storeName} · ${product.categoryName || 'Uncategorised'} · ${money(product.price)}`, image: product.imageUrl }));

  function updateBlock(id: string, update: (block: WebsiteDraftBlock) => WebsiteDraftBlock) {
    setNotice(null);
    setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].map((block) => block.id === id ? update(block) : block) }));
  }
  function toggleBlockPick(id: string, field: 'product_ids' | 'category_ids' | 'store_ids', itemId: string) {
    updateBlock(id, (block) => {
      const values = block.config[field] ?? [];
      return { ...block, config: { ...block.config, [field]: values.includes(itemId) ? values.filter((value) => value !== itemId) : [...values, itemId] } };
    });
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

  function slideItem(target?: WebsiteSlideTarget) {
    if (!target?.id) return null;
    if (target.type === 'product') {
      const product = orderedOffers.find((item) => item.productId === target.id);
      return product ? { label: product.title, image: product.imageUrl, href: websiteItemHref('product', product.slug) } : null;
    }
    if (target.type === 'category') {
      const category = categories.find((item) => item.id === target.id);
      return category ? { label: category.name, image: category.imageUrl, href: websiteItemHref('category', category.slug) } : null;
    }
    if (target.type === 'store') {
      const store = stores.find((item) => item.id === target.id);
      return store ? { label: store.name, image: store.logoUrl, href: websiteItemHref('store', store.slug) } : null;
    }
    return null;
  }

  function setBannerSlideTarget(blockId: string, index: number, type: WebsiteSlideTarget['type'], id?: string) {
    const target: WebsiteSlideTarget = type === 'manual' ? { type } : { type, id };
    const item = slideItem(target);
    updateBlock(blockId, (block) => {
      const slideTargets = [...(block.config.slide_targets ?? [])];
      slideTargets[index] = target;
      const config = { ...block.config, slide_targets: slideTargets };
      if (!item) return { ...block, config };
      const current = index === 0 ? block : block.config.slides?.[index - 1];
      const next = {
        title: item.label,
        image_url: item.image ?? '',
        cta_label: !current?.cta_label || current.cta_label === 'Shop now' ? type === 'product' ? 'View product' : type === 'category' ? 'Explore category' : 'Shop store' : current.cta_label,
      };
      if (index === 0) return { ...block, ...next, config };
      const slides = [...(block.config.slides ?? [])];
      const currentSlide: WebsiteBannerSlide = slides[index - 1] ?? { title: '', body: '', image_url: '', cta_label: '', cta_href: '' };
      slides[index - 1] = { ...currentSlide, ...next };
      return { ...block, config: { ...config, slides } };
    });
  }

  function deleteBannerSlide(blockId: string, index: number) {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    if ((block.config.slide_count ?? 1) <= 1) {
      setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].filter((item) => item.id !== blockId) }));
      setOrders((current) => ({ ...current, [pageKey]: current[pageKey].filter((token) => token !== `block:${blockId}`) }));
      setSelectedId(null);
      setNotice(null);
      return;
    }
    updateBlock(blockId, (block) => removeWebsiteBannerSlide(block, index));
  }

  function setBannerSlideShape(blockId: string, index: number, shape: NonNullable<WebsiteDraftBlock['config']['banner_size']>) {
    updateBlock(blockId, (block) => {
      const slideShapes = [...(block.config.slide_shapes ?? [])];
      slideShapes[index] = shape;
      return { ...block, config: { ...block.config, slide_shapes: slideShapes } };
    });
  }

  function setBannerSlideCount(blockId: string, requestedCount: number) {
    const count = Math.max(1, Math.min(10, Math.round(requestedCount || 1)));
    updateBlock(blockId, (block) => {
      const slides = [...(block.config.slides ?? [])].slice(0, count - 1);
      while (slides.length < count - 1) slides.push({ title: '', body: '', image_url: '', cta_label: '', cta_href: '' });
      const slideTargets = [...(block.config.slide_targets ?? [])].slice(0, count);
      while (slideTargets.length < count) slideTargets.push({ type: 'manual' });
      const slideShapes = [...(block.config.slide_shapes ?? [])].slice(0, count);
      while (slideShapes.length < count) slideShapes.push(block.config.banner_size ?? 'wide');
      return { ...block, config: { ...block.config, slide_count: count, slides, slide_targets: slideTargets, slide_shapes: slideShapes } };
    });
  }

  function addSection(type: WebsiteBlockType) {
    if (type === 'hero' && pageKey !== 'home') return;
    if ((type === 'store_rail' || type === 'store_directory') && !stores.length) {
      setNotice({ kind: 'error', text: 'Add and activate a store in Stores & Brands before creating this section.' });
      setAddOpen(false);
      return;
    }
    if (type === 'category_rail' && !categories.length) {
      setNotice({ kind: 'error', text: 'Add active categories in the catalogue before creating a category section.' });
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
      const payload = { blocks, section_order: sectionOrder, core_content: currentCoreContent };
      const result = publish ? await publishWebsiteLayout(pageKey, payload) : await saveWebsiteDraft(pageKey, payload);
      if (!result.ok) setNotice({ kind: 'error', text: result.error });
      else {
        const copied = blocks.map((block) => ({ ...block, config: { ...block.config, product_ids: block.config.product_ids ? [...block.config.product_ids] : undefined, slides: block.config.slides?.map((slide) => ({ ...slide })), slide_targets: block.config.slide_targets?.map((target) => ({ ...target })), slide_shapes: block.config.slide_shapes ? [...block.config.slide_shapes] : undefined } }));
        setSavedLayouts((current) => ({ ...current, [pageKey]: copied }));
        setSavedOrders((current) => ({ ...current, [pageKey]: [...sectionOrder] }));
        const copiedCore = JSON.parse(JSON.stringify(currentCoreContent)) as Record<string, WebsiteCoreContent>;
        setSavedCoreContent((current) => ({ ...current, [pageKey]: copiedCore }));
        if (publish) {
          setStatuses((current) => ({ ...current, [pageKey]: 'published' }));
          setPublishedLayouts((current) => ({ ...current, [pageKey]: copied }));
          setPublishedOrders((current) => ({ ...current, [pageKey]: [...sectionOrder] }));
          setPublishedCoreContent((current) => ({ ...current, [pageKey]: copiedCore }));
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
      const slides = [{ title: block.title, body: block.body, image_url: block.image_url, cta_label: block.cta_label, cta_href: block.cta_href }, ...(block.config.slides ?? [])].slice(0, Math.max(1, Math.min(10, Number(block.config.slide_count ?? 1))));
      return <div className={styles.previewBannerTrack} key={block.id}>{slides.map((slide, index) => {
        const target = block.config.slide_targets?.[index];
        const linkedItem = slideItem(target);
        const destination = target && target.type !== 'manual' ? linkedItem?.href : slide.cta_href;
        const image = slide.image_url || linkedItem?.image;
        return <article key={`${block.id}-preview-${index}`} className={`${styles.previewBanner} ${styles[`size_${block.config.slide_shapes?.[index] ?? block.config.banner_size ?? 'wide'}`]}`} style={{ background: block.config.background ?? '#f2f6ff', borderColor: block.config.accent ?? '#1554d1' }}>
          {image && <img src={image} alt=""/>}<div><small>{block.block_type === 'hero' ? 'FEATURED' : 'PROMOTION'} · {index + 1}/{slides.length}</small><b>{slide.title || linkedItem?.label || 'Campaign banner'}</b>{slide.body && <span>{renderRichPreview(slide.body)}</span>}{destination ? <a className={styles.previewDestination} href={destination} target="_blank" rel="noreferrer">{slide.cta_label || 'Open card'} ↗ <small>{destination}</small></a> : target?.type !== 'manual' ? <em>Select an item to link this card</em> : null}</div>
        </article>;
      })}</div>;
    }
    if (block.block_type === 'category_rail') {
      const ids = block.config.category_ids ?? [];
      const rank = new Map(ids.map((id, index) => [id, index]));
      const list = (ids.length ? categories.filter((category) => rank.has(category.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : categories).slice(0, block.config.count ?? 10);
      return <section className={styles.previewRail} key={block.id}><header><div><small>SELECTED CATEGORIES · EACH OPENS ITS CATEGORY PAGE</small><b>{block.title}</b></div><span>View all ↗</span></header>{block.body && <p className={styles.previewRich}>{renderRichPreview(block.body)}</p>}<div className={`${styles.previewCards} ${styles[`shape_${(block.config.visual_shape ?? 'standard').replaceAll('-', '_')}`]}`}>{list.map((category) => <article key={category.id} className={styles.previewCatalogueCard}><span>{category.imageUrl ? <img src={category.imageUrl} alt=""/> : category.name.slice(0, 1)}</span><b>{category.name}</b><small>Opens /category/{category.slug}</small></article>)}</div></section>;
    }
    if (block.block_type === 'store_directory') {
      const ids = block.config.store_ids ?? [];
      const rank = new Map(ids.map((id, index) => [id, index]));
      const list = (ids.length ? stores.filter((store) => rank.has(store.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : stores).slice(0, block.config.count ?? 10);
      return <section className={styles.previewRail} key={block.id}><header><div><small>SELECTED STORES · EACH OPENS ITS STORE PAGE</small><b>{block.title}</b></div><span>View all ↗</span></header>{block.body && <p className={styles.previewRich}>{renderRichPreview(block.body)}</p>}<div className={`${styles.previewCards} ${styles[`shape_${(block.config.visual_shape ?? 'standard').replaceAll('-', '_')}`]}`}>{list.map((store) => <article key={store.id} className={styles.previewCatalogueCard}><span>{store.logoUrl ? <img src={store.logoUrl} alt=""/> : store.name.slice(0, 1)}</span><b>{store.name}</b><small>Opens /store/{store.slug}</small></article>)}</div></section>;
    }
    const productsHere = blockProducts(block);
    if (!productsHere.length) return <div className={styles.previewEmpty} key={block.id}><b>{block.title || 'Product section'}</b><span>No matching active catalogue offers yet. Add an active store or choose another filter.</span></div>;
    return <section className={styles.previewRail} key={block.id}><header><div><small>{block.block_type === 'store_rail' ? `STORE DEALS · ${stores.find((store) => store.slug === block.config.store_slug)?.name ?? 'Selected store'}` : 'CURATED CATALOGUE · PRODUCT CARDS OPEN PDP'}</small><b>{block.title}</b></div><span>View all ↗</span></header>{block.body && <p className={styles.previewRich}>{renderRichPreview(block.body)}</p>}<div className={`${styles.previewCards} ${styles[`shape_${(block.config.visual_shape ?? 'standard').replaceAll('-', '_')}`]}`}>{productsHere.map((product) => <article key={product.productId}><img src={product.imageUrl ?? ''} alt=""/><small>{product.storeName} · {product.brand ?? product.categoryName}</small><b>{product.title}</b><strong>{money(product.price)}</strong>{product.cashback ? <em>₹{Math.round(product.cashback).toLocaleString('en-IN')} cashback</em> : null}<small>Opens /product/{product.slug}</small></article>)}</div></section>;
  }

  function cataloguePreview(key: string, defaultTitle: string, caption: string, kind: 'categories' | 'stores' | 'products') {
    const content = currentCoreContent[key] ?? {};
    const picked = kind === 'categories' ? content.category_ids : kind === 'stores' ? content.store_ids : content.product_ids;
    const rank = new Map((picked ?? []).map((id, index) => [id, index]));
    const shape = content.visual_shape ?? 'standard';
    const title = content.title || defaultTitle;
    const productsPicked = kind === 'products' && picked?.length ? orderedOffers.filter((product) => rank.has(product.productId)).sort((a, b) => (rank.get(a.productId) ?? 0) - (rank.get(b.productId) ?? 0)) : orderedOffers;
    const categoriesPicked = kind === 'categories' ? categories.filter((category) => !category.parentId && (!picked?.length || rank.has(category.id))).sort((a,b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : [];
    const storesPicked = kind === 'stores' ? stores.filter((store) => !picked?.length || rank.has(store.id)).sort((a,b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : [];
    return <section className={styles.lockedPreview}><header><div><small>CONNECTED LIVE CONTENT</small><b>{title}</b></div><span>{shape === 'standard' ? 'Card shape: standard' : `Card shape: ${shape.replaceAll('_', ' ')}`}</span></header>{content.body && <p className={styles.previewRich}>{renderRichPreview(content.body)}</p>}{kind === 'products' ? <div className={`${styles.fakeProducts} ${styles[`shape_${shape}`]}`}>{productsPicked.slice(0, content.count ?? 4).map((product) => <article key={product.productId}><img src={product.imageUrl ?? ''} alt=""/><b>{product.title}</b><small>{product.storeName} · {money(product.price)}</small></article>)}</div> : kind === 'categories' ? <div className={`${styles.fakeCategories} ${styles[`shape_${shape}`]}`}>{categoriesPicked.slice(0, content.count ?? 7).map((category) => <span key={category.id}>{category.name}</span>)}</div> : <div className={`${styles.fakeStores} ${styles[`shape_${shape}`]}`}>{storesPicked.slice(0, content.count ?? 7).map((store) => <span key={store.id}>{store.logoUrl ? <img src={store.logoUrl} alt=""/> : store.name.slice(0, 1)}{store.name}</span>)}</div>}<small>{caption}</small></section>;
  }

  function previewCore(key: string) {
    if (pageKey === 'home') {
      if (key === 'hero') return <section className={styles.defaultHero}><div><small>FEATURED DEALS</small><b>Compare before you shop.</b><span>Find the right deal across connected stores.</span><em>Explore deals →</em></div><div><small>SEASONAL PICKS</small><b>Fresh finds for every cart.</b><span>Discover products for every day.</span></div></section>;
      if (key === 'categories') return cataloguePreview(key, 'What are you shopping for?', 'Choose catalogue categories; cards open their category page.', 'categories');
      if (key === 'stores') return cataloguePreview(key, 'Shop by store', 'Choose catalogue stores; cards open their store page.', 'stores');
      if (key === 'best_deals') return cataloguePreview(key, 'Best deals right now', 'Choose products; each product card opens its product page.', 'products');
      if (key === 'trending') return cataloguePreview(key, 'Trending picks', 'Choose products; each product card opens its product page.', 'products');
      if (key === 'price_drops') return cataloguePreview(key, 'Worth a closer look', 'Choose products; each product card opens its product page.', 'products');
      return <section className={styles.coreTextPreview}><b>Glonni benefits</b><span>Trusted shopping · compare stores · eligible cashback · support</span></section>;
    }
    if (pageKey === 'stores') {
      if (key === 'store_intro') return <section className={styles.storeIntro}><small>SHOP BY STORE</small><b>{activeStore?.name ?? 'Choose a store'}</b><span>Connected store identity and current offer summary.</span><em>{orderedOffers.filter((item) => item.storeSlug === activeStore?.slug).length} available offers</em></section>;
      if (key === 'store_products') return <>{<section className={styles.lockedProductsHeader}><small>{activeStore?.name?.toUpperCase() ?? 'STORE'} PRODUCTS</small><b>Browse and compare</b><span>Search, filters and the existing product-card design stay connected.</span></section>}{cataloguePreview('store_products', `Products from ${activeStore?.name ?? 'this store'}`, 'Approved offers from this store.', 'products')}</>;
      return <section className={styles.coreTextPreview}><b>{key === 'store_policies' ? 'Store policies' : 'Store FAQs'}</b><span>Connected terms and active store-specific support answers.</span></section>;
    }
    if (key === 'product_summary') return <section className={styles.productIntro}>{activeProduct?.imageUrl && <img src={activeProduct.imageUrl} alt=""/>}<div><small>{activeProduct?.brand ?? 'GLONNI'} · {activeProduct?.categoryName ?? 'PRODUCT'}</small><b>{activeProduct?.title ?? 'Choose a product'}</b><span>Canonical product details and selected offers.</span><em>{money(activeProduct?.price ?? null)} · compare connected stores</em></div></section>;
    if (key === 'offer_comparison') return cataloguePreview('offer_comparison', 'Compare prices across stores', 'Live prices, cashback and merchant offers.', 'products');
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
      <div className={styles.topActions}><span className={`${styles.statusChip} ${statuses[pageKey] === 'published' && !hasUnpublishedDraft && !dirty ? styles.live : ''}`}><i/>{dirty ? 'Unsaved edits' : hasUnpublishedDraft ? 'Draft saved · not live' : statuses[pageKey] === 'published' ? 'Live page' : 'Draft only'}</span><a href={customerHref} target="_blank" rel="noreferrer" aria-label="Open customer page in a new tab" title="Open customer page in a new tab"><ExternalLink aria-hidden="true"/></a></div>
    </div>

    <div className={`${styles.editorGrid} ${selected || selectedCore ? styles.withInspector : ''}`}>
      <aside className={styles.sectionSidebar} aria-label="Page sections">
        <header><div><small>PAGE CONTENT</small><b>Sections</b><span>{orderedItems.length} sections · all movable</span></div></header>
        <div className={styles.sectionList}>
          {orderedItems.map((item, index) => <Fragment key={item.token}>
            <button className={`${styles.dropMarker} ${draggedId ? styles.dropReady : ''}`} type="button" disabled={!canEdit} onClick={() => addAt(index)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => { event.preventDefault(); const token = draggedId ?? event.dataTransfer.getData('text/plain'); if (token) moveItem(token, index); setDraggedId(null); }} aria-label={`Add a section before ${item.core?.title ?? item.block?.title ?? 'this section'}`}><i/><span>＋ Add here</span><small>Insert at this exact position</small></button>
            <article draggable={canEdit} className={`${styles.sectionCard} ${draggedId === item.token ? styles.dragging : ''} ${selectedId === item.block?.id && !selectedCoreKey || selectedCoreKey === item.core?.key ? styles.selected : ''} ${item.block && !item.block.is_active ? styles.hiddenCard : ''}`} onDragStart={(event) => { if (!canEdit) return; setDraggedId(item.token); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.token); }} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => { if (canEdit) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={(event) => { if (!canEdit) return; event.preventDefault(); event.stopPropagation(); const token = draggedId ?? event.dataTransfer.getData('text/plain'); if (token) moveItem(token, index); setDraggedId(null); }}>
              <button type="button" className={styles.dragHandle} aria-label={`Drag ${item.core?.title ?? item.block?.title ?? 'section'}`} title="Drag to move this whole section"><GripVertical/></button>
              <button type="button" className={styles.sectionSelect} onClick={() => { setSelectedId(item.block?.id ?? null); setSelectedCoreKey(item.core?.key ?? null); }}><span className={styles.sectionThumb}>{item.block ? item.block.block_type.includes('rail') ? <span className={styles.thumbCards}>▥</span> : item.block.image_url ? <img src={item.block.image_url} alt=""/> : <ImagePlus/> : <LayoutTemplate/>}</span><span><b>{item.core?.title ?? item.block?.title ?? titleForType(item.block!.block_type)}</b><small>{item.core?.note ?? `${titleForType(item.block!.block_type)} · ${item.block!.config.count ?? item.block!.config.slide_count ?? 1} ${item.block!.block_type === 'hero' || item.block!.block_type === 'banner' ? 'slides' : 'items'}`}</small></span></button>
              {item.block ? <button type="button" className={styles.miniToggle} aria-label={`${item.block.is_active ? 'Hide' : 'Show'} ${item.block.title}`} aria-pressed={item.block.is_active} onClick={() => updateBlock(item.block!.id, (current) => ({ ...current, is_active: !current.is_active }))}><i/></button> : <span className={styles.editableTag}>EDITABLE</span>}
            </article>
          </Fragment>)}
          <button className={`${styles.dropMarker} ${draggedId ? styles.dropReady : ''}`} type="button" disabled={!canEdit} onClick={() => addAt(orderedItems.length)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => { event.preventDefault(); const token = draggedId ?? event.dataTransfer.getData('text/plain'); if (token) moveItem(token, orderedItems.length); setDraggedId(null); }} aria-label="Add a section at the end of the page"><i/><span>＋ Add here</span><small>Insert at the end of the page</small></button>
        </div>
        <div className={styles.addSectionWrap}>
          {addOpen && <div className={styles.addMenu} role="menu"><button type="button" onClick={() => addSection('hero')} disabled={pageKey !== 'home'}><span>▣</span><b>Hero banner section</b><small>Add here · choose slide count and shape</small></button><button type="button" onClick={() => addSection('banner')}><span>▱</span><b>Promotion cards</b><small>Add here · wide, strip, square or rectangle</small></button><button type="button" onClick={() => addSection('product_rail')}><span>▤</span><b>Product cards</b><small>Choose exact products from the catalogue</small></button><button type="button" onClick={() => addSection('category_rail')}><span>⌑</span><b>Category cards</b><small>Choose any categories or subcategories</small></button><button type="button" onClick={() => addSection('store_directory')}><span>▥</span><b>Store cards</b><small>Choose connected stores to feature</small></button><button type="button" onClick={() => addSection('store_rail')}><span>↗</span><b>Deals from one store</b><small>Choose a store and number of products</small></button></div>}
          <button className={styles.addSectionButton} type="button" disabled={!canEdit} onClick={() => setAddOpen((open) => !open)}><Plus/> Add section <ChevronDown size={15}/></button>
          <p>Choose “Add here” for exact placement. Drag any section by its grip to move it intactly.</p>
        </div>
      </aside>

      <section className={styles.previewStage} aria-label="Live customer page preview">
        <header className={styles.stageHeader}><b>Preview · {pageOption.label}{pageKey === 'stores' && activeStore ? ` · ${activeStore.name}` : pageKey === 'product' && activeProduct ? ` · ${activeProduct.title}` : ''}</b><span className={styles.previewBadge}><i/>INTERACTIVE</span></header>
        <div className={styles.stageScroller}>
          <div className={`${styles.customerPage} ${widthClass}`}>
            <header className={styles.customerHeader}><b>Glonni</b><span>Search products, brands and stores…</span><small>Stores　 Deals　 Profile</small></header>
            {sectionOrder.map((token) => <Fragment key={token}>{previewOrderedSection(token)}</Fragment>)}
            <footer className={styles.previewFooter}>Glonni · Shop with clear offers and cashback terms</footer>
          </div>
        </div>
      </section>

      {(selected || selectedCore) && <aside className={styles.inspector} aria-label="Section settings">
        {!selected && !selectedCore ? <div className={styles.inspectorEmpty}><LayoutTemplate/><b>Select a section to edit</b><span>Drag any section using its grip, or choose “Add here” to place a new section exactly where you want it.</span><div><b>Pick what each card opens</b><small>Products open product pages, categories open category pages, and stores open store pages.</small></div></div> : selectedCore ? <>
          <header className={styles.inspectorHeader}><div><small>EDITABLE PAGE SECTION</small><b>{selectedCore.title}</b></div><button type="button" onClick={() => setSelectedCoreKey(null)} aria-label="Close section settings"><X/></button></header>
          <div className={styles.inspectorBody}>
            <label>Section heading<input maxLength={120} value={currentCoreContent[selectedCore.key]?.title ?? selectedCore.title} onChange={(event) => updateCoreContent(selectedCore.key, { title: event.target.value })}/></label>
            <div className={styles.richFieldLabel}><span>Supporting text</span><RichTextField value={currentCoreContent[selectedCore.key]?.body ?? ''} onChange={(body) => updateCoreContent(selectedCore.key, { body })} placeholder="Optional description"/></div>
            {pageKey === 'home' && ['categories', 'stores', 'best_deals', 'trending', 'price_drops'].includes(selectedCore.key) && <>
              <div className={styles.twoFields}><label>Number of cards<input type="number" min={1} max={50} value={currentCoreContent[selectedCore.key]?.count ?? (selectedCore.key === 'categories' || selectedCore.key === 'stores' ? 10 : 10)} onChange={(event) => updateCoreContent(selectedCore.key, { count: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}/></label>
                <label>Card shape<select value={currentCoreContent[selectedCore.key]?.visual_shape ?? 'standard'} onChange={(event) => updateCoreContent(selectedCore.key, { visual_shape: event.target.value as WebsiteVisualShape })}><option value="standard">Standard</option><option value="wide">Wide</option><option value="strip">Promotional strip</option><option value="square">Square</option><option value="rectangle_horizontal">Rectangle · horizontal</option><option value="rectangle_vertical">Rectangle · vertical</option></select></label></div>
              {selectedCore.key === 'categories' && <CataloguePicker title="Choose categories and subcategories" items={matchingCategoryChoices} selectedIds={currentCoreContent[selectedCore.key]?.category_ids ?? []} search={catalogueSearch} onSearch={setCatalogueSearch} onToggle={(id) => toggleCorePick(selectedCore.key, 'category_ids', id)}/>}
              {selectedCore.key === 'stores' && <CataloguePicker title="Choose stores" items={matchingStoreChoices} selectedIds={currentCoreContent[selectedCore.key]?.store_ids ?? []} search={catalogueSearch} onSearch={setCatalogueSearch} onToggle={(id) => toggleCorePick(selectedCore.key, 'store_ids', id)}/>}
              {['best_deals', 'trending', 'price_drops'].includes(selectedCore.key) && <CataloguePicker title="Choose products" items={matchingCoreProductChoices} selectedIds={currentCoreContent[selectedCore.key]?.product_ids ?? []} search={catalogueSearch} onSearch={setCatalogueSearch} onToggle={(id) => toggleCorePick(selectedCore.key, 'product_ids', id)}/>}
              <small className={styles.sourceNote}><Check/> Each selected card keeps its own destination: product page, category page or store page.</small>
            </>}
            <div className={styles.globalSectionNote}><b>Move it intactly</b><span>Drag the grip in the left list. This edits only the section on this page.</span></div>
          </div>
          <footer className={styles.inspectorFooter}><button type="button" className={styles.deleteButton} onClick={() => removeCoreSection(selectedCore.key)}><Trash2/> Remove section</button><span>Removes this section from the page layout only.</span></footer>
        </> : selected ? <>
          <header className={styles.inspectorHeader}><div><small>SECTION SETTINGS</small><b>{selected.title || titleForType(selected.block_type)}</b></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close section settings"><X/></button></header>
          <div className={styles.inspectorBody}>
            {(selected.block_type === 'hero' || selected.block_type === 'banner') ? <>
              <div className={styles.bannerSectionTitle}><b>Banner content</b><small>Shape and size apply to this section; every slide keeps its own content.</small></div>
              <label>Number of slides<input type="number" min={1} max={10} value={selected.config.slide_count ?? 1} onChange={(event) => setBannerSlideCount(selected.id, Number(event.target.value))}/></label>
              <small className={styles.shapeHint}>Choose the shape and linked item separately for each slide below.</small>
              {Array.from({ length: selected.config.slide_count ?? 1 }, (_, slideIndex) => {
                const extra = selected.config.slides?.[slideIndex - 1];
                const values = slideIndex === 0 ? { title: selected.title, body: selected.body, image_url: selected.image_url, cta_label: selected.cta_label, cta_href: selected.cta_href } : extra ?? { title: '', body: '', image_url: '', cta_label: '', cta_href: '' };
                const target = selected.config.slide_targets?.[slideIndex] ?? { type: 'manual' as const };
                const linkedItem = slideItem(target);
                const targetItems: PickerItem[] = target.type === 'product' ? orderedOffers.map((product) => ({ id: product.productId, label: product.title, detail: `${product.storeName} · ${money(product.price)} · ${websiteItemHref('product', product.slug)}`, image: product.imageUrl })) : target.type === 'category' ? categories.map((category) => ({ id: category.id, label: formatCategory(category, categories), detail: websiteItemHref('category', category.slug), image: category.imageUrl })) : target.type === 'store' ? stores.map((store) => ({ id: store.id, label: store.name, detail: websiteItemHref('store', store.slug), image: store.logoUrl })) : [];
                return <section className={styles.slideEditor} key={`${selected.id}-slide-editor-${slideIndex}`}><header><b>Slide {slideIndex + 1}</b><button type="button" className={styles.deleteSlide} onClick={() => deleteBannerSlide(selected.id, slideIndex)} aria-label={(selected.config.slide_count ?? 1) > 1 ? `Delete slide ${slideIndex + 1}` : 'Delete only slide and banner section'}><Trash2/> {(selected.config.slide_count ?? 1) > 1 ? 'Delete slide' : 'Delete slide & section'}</button></header>
                  <label>Card shape<select value={selected.config.slide_shapes?.[slideIndex] ?? selected.config.banner_size ?? 'wide'} onChange={(event) => setBannerSlideShape(selected.id, slideIndex, event.target.value as NonNullable<WebsiteDraftBlock['config']['banner_size']>)}><option value="wide">Full-width banner</option><option value="strip">Promotional strip</option><option value="square">Square card</option><option value="rectangle_horizontal">Horizontal rectangle card</option><option value="rectangle_vertical">Vertical rectangle card</option></select></label>
                  <label>Card opens<select value={target.type} onChange={(event) => setBannerSlideTarget(selected.id, slideIndex, event.target.value as WebsiteSlideTarget['type'])}><option value="manual">Custom link</option><option value="product">Product page</option><option value="category">Category or subcategory page</option><option value="store">Store page</option></select></label>
                  {target.type !== 'manual' && <SlideItemPicker key={`${selected.id}-${slideIndex}-${target.type}`} title={target.type === 'product' ? 'Choose a product' : target.type === 'category' ? 'Choose a category or subcategory' : 'Choose a store'} items={targetItems} selectedId={target.id} name={`slide-target-${selected.id}-${slideIndex}`} onSelect={(id) => setBannerSlideTarget(selected.id, slideIndex, target.type, id)}/>}
                  {target.type !== 'manual' && <small className={styles.sourceNote}><Check/> {linkedItem ? `The entire card opens ${linkedItem.href}` : 'Select an item above to link this card.'}</small>}
                  <label>Heading<input maxLength={120} value={values.title} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { title: event.target.value })} placeholder="e.g. Diwali essentials"/></label>
                  <div className={styles.richFieldLabel}><span>Supporting text</span><RichTextField value={values.body} onChange={(body) => updateBannerSlide(selected.id, slideIndex, { body })} placeholder="Add a short customer-friendly description"/></div>
                  {slideIndex === 0 ? <label className={styles.uploadField}>Image<span className={styles.uploadRow}><input value={values.image_url} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { image_url: event.target.value })} placeholder="Paste an HTTPS image address"/><label className={styles.uploadButton}><Upload/>{uploading === 'image_url' ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('image_url', event.currentTarget.files?.[0])} disabled={Boolean(uploading)}/></label></span></label> : <label className={styles.uploadField}>Image<span className={styles.uploadRow}><input value={values.image_url} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { image_url: event.target.value })} placeholder="Paste an HTTPS image address"/><label className={styles.uploadButton}><Upload/>{uploading === `slide-${slideIndex}` ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('image_url', event.currentTarget.files?.[0], slideIndex)} disabled={Boolean(uploading)}/></label></span></label>}
                  <div className={styles.twoFields}><label>Button label<input maxLength={60} value={values.cta_label} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { cta_label: event.target.value })} placeholder="Shop now"/></label>{target.type === 'manual' ? <label>Button link<input maxLength={500} value={values.cta_href} onChange={(event) => updateBannerSlide(selected.id, slideIndex, { cta_href: event.target.value })} placeholder="/deals or https://…"/></label> : <label>Linked page<input value={linkedItem?.href ?? 'Choose an item above'} readOnly/></label>}</div>
                </section>;
              })}
              <label className={styles.uploadField}>Mobile image for first slide (optional)<span className={styles.uploadRow}><input value={selected.config.mobile_image_url ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, mobile_image_url: event.target.value } }))} placeholder="Use a crop suited to mobile"/><label className={styles.uploadButton}><Upload/>{uploading === 'mobile_image_url' ? 'Uploading…' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage('mobile_image_url', event.currentTarget.files?.[0])} disabled={Boolean(uploading)}/></label></span></label>
              <div className={styles.twoFields}><label>Starts (optional)<input type="datetime-local" value={toLocalDateTime(selected.config.starts_at)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, starts_at: fromLocalDateTime(event.target.value) } }))}/></label><label>Ends (optional)<input type="datetime-local" value={toLocalDateTime(selected.config.ends_at)} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, ends_at: fromLocalDateTime(event.target.value) } }))}/></label></div>
            </> : <>
              <label>Section heading<input maxLength={120} value={selected.title} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, title: event.target.value }))} placeholder="e.g. Diwali essentials"/></label>
              <div className={styles.richFieldLabel}><span>Supporting text</span><RichTextField value={selected.body} onChange={(body) => updateBlock(selected.id, (block) => ({ ...block, body }))} placeholder="Add a short customer-friendly description"/></div>
            </>}
            {(selected.block_type === 'category_rail' || selected.block_type === 'store_directory') && <>
              <label>Card shape<select value={selected.config.visual_shape ?? 'standard'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, visual_shape: event.target.value as WebsiteVisualShape } }))}><option value="standard">Standard</option><option value="wide">Wide</option><option value="strip">Promotional strip</option><option value="square">Square</option><option value="rectangle_horizontal">Rectangle · horizontal</option><option value="rectangle_vertical">Rectangle · vertical</option></select></label>
              <label>Number of cards<input type="number" min={1} max={50} value={selected.config.count ?? 10} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, count: Math.max(1, Math.min(50, Number(event.target.value) || 1)) } }))}/></label>
              {selected.block_type === 'category_rail' && <CataloguePicker title="Choose categories and subcategories" items={matchingCategoryChoices} selectedIds={selected.config.category_ids ?? []} search={catalogueSearch} onSearch={setCatalogueSearch} onToggle={(id) => toggleBlockPick(selected.id, 'category_ids', id)}/>}
              {selected.block_type === 'store_directory' && <CataloguePicker title="Choose stores" items={matchingStoreChoices} selectedIds={selected.config.store_ids ?? []} search={catalogueSearch} onSearch={setCatalogueSearch} onToggle={(id) => toggleBlockPick(selected.id, 'store_ids', id)}/>}
              <small className={styles.sourceNote}><Check/> Selecting a card links to that exact category or store page. You can add the same category or store section again elsewhere.</small>
            </>}
            {(selected.block_type === 'product_rail' || selected.block_type === 'store_rail') && <>
              <label>Card shape<select value={selected.config.visual_shape ?? 'standard'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, visual_shape: event.target.value as WebsiteVisualShape } }))}><option value="standard">Standard</option><option value="wide">Wide</option><option value="strip">Promotional strip</option><option value="square">Square</option><option value="rectangle_horizontal">Rectangle · horizontal</option><option value="rectangle_vertical">Rectangle · vertical</option></select></label>
              {selected.block_type === 'store_rail' && <label>Store<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => { const previousHref = block.config.store_slug ? `/store/${block.config.store_slug}` : '/deals'; const nextSlug = event.target.value; return { ...block, cta_href: block.cta_href === previousHref || block.cta_href === '/deals' ? `/store/${nextSlug}` : block.cta_href, config: { ...block.config, store_slug: nextSlug } }; })}><option value="">Choose a connected store</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
              {selected.block_type === 'product_rail' && <>
                <label>Product source<select value={selected.config.source_mode ?? 'all'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, source_mode: event.target.value as 'all' | 'curated' } }))}><option value="all">All matching active products</option><option value="curated">Choose specific products</option></select></label>
                <label>Filter by store (optional)<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, store_slug: event.target.value || undefined } }))}><option value="">All connected stores</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>
              </>}
              <label>Filter by category (optional)<select value={selected.config.category_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, category_slug: event.target.value || undefined } }))}><option value="">All categories</option>{categories.map((category) => <option value={category.slug} key={category.id}>{formatCategory(category, categories)}</option>)}</select></label>
              <div className={styles.twoFields}><label>Number of products<input type="number" min={1} max={50} value={selected.config.count ?? 10} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, count: Math.max(1, Math.min(50, Number(event.target.value) || 1)) } }))}/></label><label>Sort by<select value={selected.config.sort ?? 'best_deal'} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, sort: event.target.value as 'best_deal' | 'trending' | 'price_drop' | 'newest' } }))}><option value="best_deal">Best effective price</option><option value="trending">Top rated first</option><option value="price_drop">Highest discount first</option><option value="newest">Recently updated</option></select></label></div>
              {selected.block_type === 'product_rail' && selected.config.source_mode === 'curated' && <CataloguePicker title="Choose products" items={choices.map((product) => ({ id: product.productId, label: product.title, detail: `${product.storeName} · ${product.categoryName || 'Uncategorised'} · ${money(product.price)} · /product/${product.slug}`, image: product.imageUrl }))} selectedIds={selected.config.product_ids ?? []} search={productSearch} onSearch={setProductSearch} onToggle={(id) => toggleBlockPick(selected.id, 'product_ids', id)}/>}
              <small className={styles.sourceNote}><Check/> Sections show products only when their store offer is active and approved in the customer catalogue.</small>
            </>}
            {(selected.block_type === 'product_rail' || selected.block_type === 'store_rail' || selected.block_type === 'category_rail' || selected.block_type === 'store_directory') && <>
              <label>Button label (optional)<input maxLength={60} value={selected.cta_label} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, cta_label: event.target.value }))} placeholder="e.g. View all deals"/></label>
              {selected.cta_label && <label>Button destination<input maxLength={500} value={selected.cta_href} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, cta_href: event.target.value }))} placeholder="/deals or https://…"/></label>}
            </>}
            {pageKey === 'stores' && <label>Show on store page<select value={selected.config.store_slug ?? ''} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, config: { ...block.config, store_slug: event.target.value || undefined } }))}><option value="">All store pages</option>{stores.map((store) => <option value={store.slug} key={store.id}>{store.name}</option>)}</select></label>}
            <label>Show on<select value={selected.device_visibility} onChange={(event) => updateBlock(selected.id, (block) => ({ ...block, device_visibility: event.target.value as 'all' | 'desktop' | 'mobile' }))}><option value="all">Desktop, tablet and mobile</option><option value="desktop">Desktop and tablet</option><option value="mobile">Mobile only</option></select></label>
            <div className={styles.toggleRow}><span><b>Visible to customers</b><small>Turn off to hide this section at next publish.</small></span><button type="button" className={selected.is_active ? styles.toggleOn : ''} aria-pressed={selected.is_active} onClick={() => updateBlock(selected.id, (block) => ({ ...block, is_active: !block.is_active }))}><i/></button></div>
          </div>
          <footer className={styles.inspectorFooter}><button type="button" className={styles.deleteButton} onClick={() => { setNotice(null); setLayouts((current) => ({ ...current, [pageKey]: current[pageKey].filter((block) => block.id !== selected.id) })); setOrders((current) => ({ ...current, [pageKey]: current[pageKey].filter((token) => token !== `block:${selected.id}`) })); setSelectedId(null); }}><Trash2/> Remove section</button><span>Removes only this custom section from the draft.</span></footer>
        </> : null}
      </aside>}
    </div>
    <footer className={styles.saveBar}>
      <div>{notice ? <p className={notice.kind === 'success' ? styles.success : styles.error}><i>{notice.kind === 'success' ? <Check/> : <X/>}</i>{notice.text}</p> : <p className={dirty || hasUnpublishedDraft ? styles.unsaved : styles.saved}><i>{dirty || hasUnpublishedDraft ? '!' : <Check/>}</i>{dirty ? 'Unsaved changes' : hasUnpublishedDraft ? 'Draft saved · not live' : 'All changes saved'}<small>{dirty ? 'Save draft to keep your work. Customers are not affected until you publish.' : hasUnpublishedDraft ? 'Shoppers still see the previously published layout until you publish this draft.' : 'Draft and published page are in sync.'}</small></p>}</div>
      <div className={styles.saveActions}><button type="button" className={styles.saveDraft} onClick={() => void save(false)} disabled={busy || !canEdit}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" className={styles.publish} onClick={() => void save(true)} disabled={busy || !canEdit}>{busy ? 'Publishing…' : 'Publish changes'}<ChevronRight/></button></div>
    </footer>
  </section>;
}
