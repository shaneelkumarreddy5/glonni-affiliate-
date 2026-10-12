import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProviderCommissions, financeCsvCell } from '../lib/admin-finance.ts';

const conversion = (overrides = {}) => ({ id: 'report', provider_id: 'provider', currency: 'INR', commission_amount: 10, status: 'pending', financial_validation_status: 'pending', affiliate_providers: { name: 'Provider', adapter_key: 'adapter' }, ...overrides });

test('empty provider reports contain no sample commissions', () => {
  assert.deepEqual(summarizeProviderCommissions([]), []);
});
test('reports never combine currencies or providers', () => {
  const groups = summarizeProviderCommissions([
    conversion({ commission_amount: '125.50' }),
    conversion({ currency: 'USD', commission_amount: '2.75' }),
    conversion({ provider_id: 'other', commission_amount: '42' }),
  ]);
  assert.deepEqual(groups.map(row => [row.providerId, row.currency, row.reported]), [['provider', 'INR', 125.5], ['provider', 'USD', 2.75], ['other', 'INR', 42]]);
});
test('provider and finance approval are both required for validated commissions', () => {
  const [row] = summarizeProviderCommissions([
    conversion({ commission_amount: 10, status: 'confirmed', financial_validation_status: 'approved' }),
    conversion({ commission_amount: 20, status: 'confirmed' }),
    conversion({ commission_amount: 30, financial_validation_status: 'approved' }),
    conversion({ commission_amount: 40, financial_validation_status: 'held' }),
    conversion({ commission_amount: 50, status: 'rejected', financial_validation_status: 'approved' }),
    conversion({ commission_amount: 60, status: 'cancelled' }),
    conversion({ commission_amount: 70, financial_validation_status: 'rejected' }),
  ]);
  assert.equal(row.reported, 280);
  assert.equal(row.approved, 10);
  assert.equal(row.pending, 50);
  assert.equal(row.held, 40);
  assert.equal(row.rejected, 180);
  assert.equal(row.orders, 7);
});
test('unlinked and zero/invalid amounts do not become fake money', () => {
  const [row] = summarizeProviderCommissions([
    conversion({ provider_id: null, affiliate_providers: null, commission_amount: 'invalid' }),
    conversion({ provider_id: null, affiliate_providers: null, commission_amount: null }),
    conversion({ provider_id: null, affiliate_providers: null, commission_amount: -1 }),
  ]);
  assert.equal(row.orders, 3);
  assert.equal(row.unpricedOrders, 3);
  assert.equal(row.reported, 0);
  assert.equal(row.name, 'Provider not linked');
});
test('an explicitly reported zero commission is not a missing amount', () => {
  const [row] = summarizeProviderCommissions([conversion({ commission_amount: 0 })]);
  assert.equal(row.reported, 0);
  assert.equal(row.unpricedOrders, 0);
});
test('CSV neutralizes formulas and safely quotes arbitrary provider names', () => {
  for (const value of ['=SUM(A1:A2)', '+COMMAND', '-COMMAND', '@COMMAND', ' \t=COMMAND']) assert.ok(financeCsvCell(value).startsWith('"\''));
  assert.equal(financeCsvCell('A "quoted", name'), '"A ""quoted"", name"');
  assert.equal(financeCsvCell(-12.5), '"-12.5"');
});
