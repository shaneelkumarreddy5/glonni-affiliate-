import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultWebsiteSectionOrder, insertWebsiteSection, moveWebsiteSection, resolveWebsiteSectionOrder } from '../lib/website-layout.ts';

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

test('saved drag order is preserved while missing or duplicate entries are repaired', () => {
  const blocks = [block('one', 'after_categories')];
  const order = resolveWebsiteSectionOrder('home', blocks, ['core:stores', 'block:one', 'core:stores', 'unknown']);
  assert.equal(order[0], 'core:stores');
  assert.equal(order[1], 'block:one');
  assert.equal(new Set(order).size, order.length);
  assert.equal(order.length, 8);
});

test('drop targets place the complete section before, after, or at the chosen point', () => {
  const initial = ['core:hero', 'block:one', 'core:categories'];
  assert.deepEqual(moveWebsiteSection(initial, 'core:hero', 3), ['block:one', 'core:categories', 'core:hero']);
  assert.deepEqual(moveWebsiteSection(initial, 'core:categories', 1), ['core:hero', 'core:categories', 'block:one']);
  assert.deepEqual(insertWebsiteSection(initial, 'block:two', 1), ['core:hero', 'block:two', 'block:one', 'core:categories']);
});
