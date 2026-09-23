import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultWebsiteSectionOrder, insertWebsiteSection, moveWebsiteSection, removeWebsiteBannerSlide, resolveWebsiteSectionOrder, websiteItemHref } from '../lib/website-layout.ts';

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

test('drop targets place the complete section before, after, or at the chosen point', () => {
  const initial = ['core:hero', 'block:one', 'core:categories'];
  assert.deepEqual(moveWebsiteSection(initial, 'core:hero', 3), ['block:one', 'core:categories', 'core:hero']);
  assert.deepEqual(moveWebsiteSection(initial, 'core:categories', 1), ['core:hero', 'core:categories', 'block:one']);
  assert.deepEqual(insertWebsiteSection(initial, 'block:two', 1), ['core:hero', 'block:two', 'block:one', 'core:categories']);
});

test('catalogue slide destinations open the selected product, subcategory or store', () => {
  assert.equal(websiteItemHref('product', 'iphone-18-pro'), '/product/iphone-18-pro');
  assert.equal(websiteItemHref('category', 'mens-shirts'), '/category/mens-shirts');
  assert.equal(websiteItemHref('store', 'amazon'), '/store/amazon');
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
    },
  };
  const afterFirst = removeWebsiteBannerSlide(banner, 0);
  assert.equal(afterFirst.title, 'Second');
  assert.equal(afterFirst.cta_href, '/second');
  assert.deepEqual(afterFirst.config.slide_targets, [{ type: 'category', id: 'two' }, { type: 'store', id: 'three' }]);
  assert.deepEqual(afterFirst.config.slide_shapes, ['rectangle_horizontal', 'rectangle_vertical']);
  assert.equal(afterFirst.config.slides[0].title, 'Third');
  assert.equal(afterFirst.config.slide_count, 2);
  const afterLast = removeWebsiteBannerSlide(afterFirst, 1);
  assert.equal(afterLast.title, 'Second');
  assert.deepEqual(afterLast.config.slide_targets, [{ type: 'category', id: 'two' }]);
  assert.deepEqual(afterLast.config.slide_shapes, ['rectangle_horizontal']);
  assert.deepEqual(afterLast.config.slides, []);
  assert.equal(removeWebsiteBannerSlide(afterLast, 0), afterLast);
});
