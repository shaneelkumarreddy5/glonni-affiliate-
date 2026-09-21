import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPublicOfferFilters,
  hasCompleteStoreOffer,
  missingPublicationRequirements,
} from '../lib/product-publication-rules.ts';

class MockOfferQuery {
  constructor(rows) { this.rows = rows; }
  eq(column, value) { this.rows = this.rows.filter((row) => read(row, column) === value); return this; }
  gt(column, value) { this.rows = this.rows.filter((row) => Number(read(row, column)) > value); return this; }
  not(column, operator, value) {
    assert.equal(operator, 'is');
    this.rows = this.rows.filter((row) => read(row, column) !== value);
    return this;
  }
  neq(column, value) { this.rows = this.rows.filter((row) => read(row, column) !== value); return this; }
}

const read = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
const product = () => ({ id: 'product-1', slug: 'mock-phone', title: 'Mock Phone', category_id: 'phones', image_url: 'https://example.com/phone.jpg', is_active: false });
const merchant = (id, slug) => ({ id, slug, is_active: true });
const offer = (id, linkedProduct, store, changes = {}) => ({
  id, status: 'draft', current_price: 100, destination_url: `https://example.com/${id}`,
  products: linkedProduct, merchants: store, ...changes,
});
const visible = (offers) => applyPublicOfferFilters(new MockOfferQuery(offers)).rows;

test('approval requires identity, category, image and a priced destination', () => {
  assert.deepEqual(missingPublicationRequirements({ title: ' ', category_id: null, image_url: null, offers: [] }), [
    'product name', 'category', 'primary image', 'complete store offer',
  ]);
  assert.deepEqual(missingPublicationRequirements({ ...product(), offers: [{ current_price: 0, destination_url: 'https://example.com', status: 'draft' }] }), ['complete store offer']);
  assert.deepEqual(missingPublicationRequirements({ ...product(), offers: [{ current_price: 100, destination_url: '  ', status: 'draft' }] }), ['complete store offer']);
});

test('direct publication requires an already active offer', () => {
  const draftOffer = { current_price: 100, destination_url: 'https://example.com/mock', status: 'draft' };
  assert.deepEqual(missingPublicationRequirements({ ...product(), offers: [draftOffer] }, true), ['active store offer with a price and destination URL']);
  assert.deepEqual(missingPublicationRequirements({ ...product(), offers: [{ ...draftOffer, status: 'active' }] }, true), []);
  assert.equal(hasCompleteStoreOffer([draftOffer], true), false);
});

test('approved product appears globally, in its store and on its product page', () => {
  const phone = product(), amazon = merchant('amazon', 'amazon'), other = merchant('other', 'other-store');
  const amazonOffer = offer('amazon-offer', phone, amazon);
  const otherOffer = offer('other-offer', phone, other);
  assert.equal(visible([amazonOffer, otherOffer]).length, 0);
  amazonOffer.status = 'active';
  otherOffer.status = 'active';
  phone.is_active = true;
  const globalOffers = visible([amazonOffer, otherOffer]);
  assert.deepEqual(globalOffers.map((row) => row.id), ['amazon-offer', 'other-offer']);
  assert.deepEqual(globalOffers.filter((row) => row.merchants.slug === 'amazon').map((row) => row.id), ['amazon-offer']);
  assert.deepEqual(globalOffers.filter((row) => row.products.slug === 'mock-phone').map((row) => row.id), ['amazon-offer', 'other-offer']);
});

test('unpublishing removes customer listings and blocks handoff and outbound lookup', () => {
  const phone = { ...product(), is_active: true };
  const entry = offer('seller-offer', phone, merchant('seller', 'seller'), { status: 'active' });
  assert.equal(visible([entry]).length, 1);
  phone.is_active = false;
  assert.equal(visible([entry]).length, 0);
  assert.equal(visible([entry]).find((row) => row.id === 'seller-offer'), undefined);
});

test('inactive store, inactive offer, zero price and missing destination never reach shoppers', () => {
  const phone = { ...product(), is_active: true }, store = merchant('seller', 'seller');
  const entry = offer('seller-offer', phone, store, { status: 'active' });
  for (const change of [
    { status: 'draft' }, { current_price: 0 },
    { destination_url: '' }, { destination_url: null },
  ]) assert.equal(visible([{ ...entry, ...change }]).length, 0);
  store.is_active = false;
  assert.equal(visible([entry]).length, 0);
});
