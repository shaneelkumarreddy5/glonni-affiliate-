import test from 'node:test';
import assert from 'node:assert/strict';
import { cuelinksDisplayLink, cuelinksDisplayRows, cuelinksErrorMessage } from '../lib/cuelinks-display.ts';

test('Cuelinks display exposes only allowlisted listing fields', () => {
  assert.deepEqual(cuelinksDisplayRows({ campaigns: [{ id: 2, name: 'Merchant', description: 'Offer', api_key: 'not-for-display', private_data: { secret: true } }] }), [{ id: '2', name: 'Merchant', description: 'Offer', details: '' }]);
});
test('Cuelinks array/nested envelopes are supported without inventing records', () => {
  assert.deepEqual(cuelinksDisplayRows({ data: { offers: [{ offer_id: 3, title: 'Coupon', offer_type: 'code' }] } }), [{ id: '3', name: 'Coupon', description: 'code', details: 'Type: code' }]);
  assert.deepEqual(cuelinksDisplayRows({ message: 'unsupported' }), []);
  assert.deepEqual(cuelinksDisplayRows(null), []);
  assert.deepEqual(cuelinksDisplayRows([null, 'invalid']), []);
});
test('Cuelinks tracking links are allowlisted HTTPS URLs and preserve campaign status', () => {
  assert.deepEqual(cuelinksDisplayLink({ data: { tracking_url: 'https://linksredirect.com/?cid=1&subid=x', original_url: 'https://shop.example/product', affiliated: true, campaign: { name: 'Shop' }, api_key: 'hidden' } }), {
    trackingUrl: 'https://linksredirect.com/?cid=1&subid=x', originalUrl: 'https://shop.example/product', affiliated: true, campaignName: 'Shop',
  });
  assert.equal(cuelinksDisplayLink({ tracking_url: 'javascript:alert(1)' }), null);
});
test('Cuelinks tables limit records and long public text', () => {
  const rows = cuelinksDisplayRows(Array.from({ length: 30 }, (_, id) => ({ id, name: 'x'.repeat(400) })));
  assert.equal(rows.length, 25);
  assert.equal(rows[0].name.length, 240);
});
test('unknown provider errors never echo raw credentials or messages', () => {
  const message = cuelinksErrorMessage('untrusted-provider-message');
  assert.ok(!message.includes('untrusted-provider-message'));
  assert.match(cuelinksErrorMessage('not_configured'), /Supabase/);
  assert.match(cuelinksErrorMessage('', 403), /two-step/);
});
