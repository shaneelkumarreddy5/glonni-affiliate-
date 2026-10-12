import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIndiaPhone } from '../lib/phone-auth.ts';

test('India phone numbers normalize to E.164 with or without country prefix', () => {
  assert.equal(normalizeIndiaPhone('98765 43210'), '+919876543210');
  assert.equal(normalizeIndiaPhone('+91 98765-43210'), '+919876543210');
  assert.equal(normalizeIndiaPhone('919876543210'), '+919876543210');
});

test('phone normalization rejects invalid and non-India numbers', () => {
  assert.equal(normalizeIndiaPhone('51234 56789'), '');
  assert.equal(normalizeIndiaPhone('+1 415 555 0100'), '');
  assert.equal(normalizeIndiaPhone('98765 4321'), '');
  assert.equal(normalizeIndiaPhone(null), '');
});
