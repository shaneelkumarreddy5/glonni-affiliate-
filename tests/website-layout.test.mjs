import assert from 'node:assert/strict';
import test from 'node:test';
import { coreSectionsByPage, DEFAULT_WEBSITE_BANNER_BUTTON_LAYOUT, defaultWebsiteSectionOrder, ensureStorePolicyBeforeFaq, hasVisibleWebsiteBannerSlideContent, insertWebsiteSection, moveWebsiteSection, normalizeWebsiteBannerButtonLayout, normalizeWebsiteServiceTypes, removeWebsiteBannerSlide, resolveWebsiteSectionOrder, resolveWebsiteSlideItems, websiteItemHref, websitePageOptions, websiteServiceTypeOptions } from '../lib/website-layout.ts';

const block = (id, slot) => ({
  id,
  block_type: 'banner',
  title: id,
  body: '',
  cta_label: '',
  cta_href: '',
  image_url: '',
  config: { slot },
  device_visibility: 'all',
  is_active: true,
});

test('legacy website slots map custom sections beside their previous anchors', () => {
  const order = defaultWebsiteSectionOrder('home', [block('one', 'after_categories'), block('two', 'after_hero')]);
  assert.deepEqual(order.slice(0, 5), [
    'core:hero', 'block:two', 'core:categories', 'block:one', 'core:stores',
  ]);
});

test('category, deals and coupons builder templates expose their live sections without changing existing templates', () => {
  assert.deepEqual(coreSectionsByPage.home.map((section) => section.key), ['hero', 'categories', 'stores', 'best_deals', 'trending', 'price_drops', 'benefits']);
  assert.deepEqual(coreSectionsByPage.stores.map((section) => section.key), ['store_intro', 'store_products', 'store_policies', 'store_faqs']);
  assert.deepEqual(coreSectionsByPage.product.map((section) => section.key), ['product_summary', 'offer_comparison', 'price_history', 'specifications', 'product_information', 'store_policies', 'product_faqs', 'related_products', 'disclosure']);
  assert.deepEqual(coreSectionsByPage.category.map((section) => section.key), ['category_intro', 'category_stores', 'category_subcategories', 'category_results']);
  assert.deepEqual(coreSectionsByPage.deals.map((section) => section.key), ['deals_intro', 'deals_categories', 'deals_tabs', 'deals_results']);
  assert.deepEqual(coreSectionsByPage.coupons.map((section) => section.key), ['coupons_intro', 'coupons_tabs', 'coupons_content']);
  assert.deepEqual(websitePageOptions.slice(-3).map((page) => page.route), ['/category', '/deals', '/vouchers-bills']);
  assert.deepEqual(defaultWebsiteSectionOrder('category', [block('old-category-block', 'after_heading')]).slice(0, 3), ['core:category_intro', 'block:old-category-block', 'core:category_stores']);
  assert.deepEqual(defaultWebsiteSectionOrder('deals', [block('old-deals-block', 'before_results')]).slice(0, 4), ['core:deals_intro', 'core:deals_categories', 'core:deals_tabs', 'block:old-deals-block']);
});

test('saved page composition is preserved and only newly-added custom sections are appended', () => {
  const blocks = [block('one', 'after_categories')];
  const order = resolveWebsiteSectionOrder('home', blocks, ['core:stores', 'block:one', 'core:stores', 'unknown']);
  assert.equal(order[0], 'core:stores');
  assert.equal(order[1], 'block:one');
  assert.deepEqual(order, ['core:stores', 'block:one']);
  assert.equal(new Set(order).size, order.length);
});

test('an explicitly empty saved composition removes every built-in section', () => {
  assert.deepEqual(resolveWebsiteSectionOrder('home', [], []), []);
});

test('legacy store page compositions place terms before their existing FAQ section', () => {
  const order = ['core:store_intro', 'core:store_products', 'core:store_faqs'];
  assert.deepEqual(ensureStorePolicyBeforeFaq(order), [
    'core:store_intro', 'core:store_products', 'core:store_policies', 'core:store_faqs',
  ]);
  assert.deepEqual(ensureStorePolicyBeforeFaq(['core:store_policies', 'core:store_faqs']), ['core:store_policies', 'core:store_faqs']);
  assert.deepEqual(ensureStorePolicyBeforeFaq(['core:store_products', 'core:store_faqs', 'core:store_policies']), ['core:store_products', 'core:store_policies', 'core:store_faqs']);
  assert.deepEqual(ensureStorePolicyBeforeFaq(['core:store_products']), ['core:store_products']);
});

test('drop targets place the complete section before, after, or at the chosen point', () => {
  const initial = ['core:hero', 'block:one', 'core:categories'];
  assert.deepEqual(moveWebsiteSection(initial, 'core:hero', 3), ['block:one', 'core:categories', 'core:hero']);
  assert.deepEqual(moveWebsiteSection(initial, 'core:categories', 1), ['core:hero', 'core:categories', 'block:one']);
  assert.deepEqual(insertWebsiteSection(initial, 'block:two', 1), ['core:hero', 'block:two', 'block:one', 'core:categories']);
});

test('a missing built-in page section can be restored at the chosen insertion point', () => {
  assert.deepEqual(insertWebsiteSection(['core:categories', 'core:stores'], 'core:hero', 0), ['core:hero', 'core:categories', 'core:stores']);
});

test('catalogue slide destinations open the selected product, subcategory or store', () => {
  assert.equal(websiteItemHref('product', 'iphone-18-pro'), '/product/iphone-18-pro');
  assert.equal(websiteItemHref('category', 'mens-shirts'), '/category/mens-shirts');
  assert.equal(websiteItemHref('store', 'amazon'), '/store/amazon');
});

test('Vouchers & Bills section types accept one, multiple or all supported services only', () => {
  assert.deepEqual(normalizeWebsiteServiceTypes(['gift_cards']), ['gift_cards']);
  assert.deepEqual(normalizeWebsiteServiceTypes(['mobile_recharge', 'bill_payments']), ['mobile_recharge', 'bill_payments']);
  assert.deepEqual(normalizeWebsiteServiceTypes(websiteServiceTypeOptions.map((option) => option.key)), ['gift_cards', 'mobile_recharge', 'bill_payments']);
  assert.deepEqual(normalizeWebsiteServiceTypes(['gift_cards', 'gift_cards', 'unsupported']), ['gift_cards']);
  assert.equal(websiteServiceTypeOptions.find((option) => option.key === 'gift_cards')?.href, '/vouchers-bills?tab=buy');
  assert.equal(websiteServiceTypeOptions.find((option) => option.key === 'mobile_recharge')?.href, '/vouchers-bills?type=mobile-recharge');
  assert.equal(websiteServiceTypeOptions.find((option) => option.key === 'bill_payments')?.href, '/vouchers-bills?type=bill-payments');
});

test('blank slides do not render live, even when they already have a destination', () => {
  const blank = { title: '', body: '', image_url: '', cta_label: '', cta_href: '' };
  assert.equal(hasVisibleWebsiteBannerSlideContent(blank), false);
  assert.equal(hasVisibleWebsiteBannerSlideContent(blank, 1, true), false, 'a linked destination alone must not create a blank clickable slide');
  assert.equal(hasVisibleWebsiteBannerSlideContent({ ...blank, cta_label: 'Shop now' }, 0, true), true);
  assert.equal(hasVisibleWebsiteBannerSlideContent({ ...blank, image_url: '/campaign.png' }), true);
  assert.equal(hasVisibleWebsiteBannerSlideContent(blank, 2, false), true, 'multiple linked destinations are visible as separate links');
});

test('banner buttons get a centered lower default and safe persisted size and position limits', () => {
  assert.deepEqual(DEFAULT_WEBSITE_BANNER_BUTTON_LAYOUT, { x: 50, y: 82, width: 124, height: 44 });
  assert.deepEqual(normalizeWebsiteBannerButtonLayout({ x: 130, y: -12, width: 900, height: 12 }), { x: 100, y: 0, width: 480, height: 36 });
  assert.deepEqual(normalizeWebsiteBannerButtonLayout(), DEFAULT_WEBSITE_BANNER_BUTTON_LAYOUT);
});

test('a slide resolves mixed stores, subcategories and individual products from approved catalogue rows', () => {
  const stores = [{ id: 'store-a', name: 'Amazon', slug: 'amazon', imageUrl: null }, { id: 'store-b', name: 'Flipkart', slug: 'flipkart', imageUrl: null }];
  const categories = [{ id: 'fashion', name: 'Fashion', slug: 'fashion', parentId: null }, { id: 'men', name: 'Men', slug: 'men', parentId: 'fashion' }, { id: 'shirts', name: 'Shirts', slug: 'shirts', parentId: 'men' }];
  const products = [
    { id: 'shirt', title: 'Blue shirt', slug: 'blue-shirt', categoryId: 'shirts', storeSlug: 'amazon', price: 500 },
    { id: 'shirt', title: 'Blue shirt', slug: 'blue-shirt', categoryId: 'shirts', storeSlug: 'flipkart', price: 400 },
    { id: 'other', title: 'Red shirt', slug: 'red-shirt', categoryId: 'shirts', storeSlug: 'amazon', price: 600 },
  ];
  const resolved = resolveWebsiteSlideItems([{ type: 'store', id: 'store-a', product_count: 1 }, { type: 'category', id: 'men', product_count: 2 }, { type: 'product', id: 'shirt' }], stores, categories, products);
  assert.deepEqual(resolved.map((item) => item.href), ['/store/amazon', '/category/men', '/product/blue-shirt']);
  assert.deepEqual(resolved[0].products.map((product) => product.id), ['shirt']);
  assert.equal(resolved[0].products[0].price, 500, 'store content must not use another store’s cheaper offer');
  assert.deepEqual(resolved[1].products.map((product) => product.id), ['shirt', 'other']);
  assert.equal(resolved[1].name, 'Fashion › Men');
  assert.equal(resolved[2].products[0].price, 400, 'individual product uses the best active offer');
  const leaf = resolveWebsiteSlideItems([{ type: 'category', id: 'shirts', product_count: 1 }], stores, categories, products);
  assert.equal(leaf[0].name, 'Fashion › Men › Shirts');
  assert.equal(leaf[0].products.length, 1);
  assert.deepEqual(resolveWebsiteSlideItems([{ type: 'product', id: 'not-published' }], stores, categories, products), []);
});

test('deleting a selected slide keeps the remaining content and linked items aligned', () => {
  const banner = {
    ...block('banner', 'after_hero'),
    title: 'First', body: 'First body', image_url: '/first.png', cta_label: 'First CTA', cta_href: '/first',
    config: {
      slot: 'after_hero', slide_count: 3,
      slides: [
        { title: 'Second', body: 'Second body', image_url: '/second.png', cta_label: 'Second CTA', cta_href: '/second' },
        { title: 'Third', body: 'Third body', image_url: '/third.png', cta_label: 'Third CTA', cta_href: '/third' },
      ],
      slide_targets: [{ type: 'product', id: 'one' }, { type: 'category', id: 'two' }, { type: 'store', id: 'three' }],
      slide_shapes: ['wide', 'rectangle_horizontal', 'rectangle_vertical'],
      slide_items: [[{ type: 'store', id: 'store-a' }], [{ type: 'category', id: 'fashion' }], [{ type: 'product', id: 'shirt' }]],
      slide_button_layouts: [{ x: 50, y: 82, width: 124, height: 44 }, { x: 25, y: 30, width: 160, height: 50 }, { x: 75, y: 40, width: 140, height: 48 }],
    },
  };
  const afterFirst = removeWebsiteBannerSlide(banner, 0);
  assert.equal(afterFirst.title, 'Second');
  assert.equal(afterFirst.cta_href, '/second');
  assert.deepEqual(afterFirst.config.slide_targets, [{ type: 'category', id: 'two' }, { type: 'store', id: 'three' }]);
  assert.deepEqual(afterFirst.config.slide_shapes, ['rectangle_horizontal', 'rectangle_vertical']);
  assert.deepEqual(afterFirst.config.slide_items, [[{ type: 'category', id: 'fashion' }], [{ type: 'product', id: 'shirt' }]]);
  assert.deepEqual(afterFirst.config.slide_button_layouts, [{ x: 25, y: 30, width: 160, height: 50 }, { x: 75, y: 40, width: 140, height: 48 }]);
  assert.equal(afterFirst.config.slides[0].title, 'Third');
  assert.equal(afterFirst.config.slide_count, 2);
  const afterLast = removeWebsiteBannerSlide(afterFirst, 1);
  assert.equal(afterLast.title, 'Second');
  assert.deepEqual(afterLast.config.slide_targets, [{ type: 'category', id: 'two' }]);
  assert.deepEqual(afterLast.config.slide_shapes, ['rectangle_horizontal']);
  assert.deepEqual(afterLast.config.slide_items, [[{ type: 'category', id: 'fashion' }]]);
  assert.deepEqual(afterLast.config.slide_button_layouts, [{ x: 25, y: 30, width: 160, height: 50 }]);
  assert.deepEqual(afterLast.config.slides, []);
  assert.equal(removeWebsiteBannerSlide(afterLast, 0), afterLast);
});
