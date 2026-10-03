import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWallet } from '../lib/wallet-balances.ts';

test('cashback and points remain separate through tracking, pending and available stages', () => {
  const entries = [{ amount: 800, entry_type: 'cashback_confirmed' }];
  const withdrawals = [{ amount: 100, status: 'requested' }];
  const cashbackAwards = [{ conversion_id: 'cash-pending', amount: 250, status: 'pending' }];
  const pointAwards = [
    { conversion_id: 'point-available', points: 1200, status: 'confirmed' },
    { conversion_id: 'point-pending', points: 300, status: 'pending' },
  ];
  const conversions = [
    { id: 'cash-tracking', status: 'pending', reward_type_snapshot: 'fixed_cashback', cashback_fixed_snapshot: 120, cashback_percent_snapshot: null, cashback_cap_snapshot: null, order_value: 1000, reward_points_snapshot: null },
    { id: 'points-tracking', status: 'pending', reward_type_snapshot: 'points', cashback_fixed_snapshot: null, cashback_percent_snapshot: null, cashback_cap_snapshot: null, order_value: 1000, reward_points_snapshot: 150 },
    { id: 'cash-pending', status: 'pending', reward_type_snapshot: 'fixed_cashback', cashback_fixed_snapshot: 250, cashback_percent_snapshot: null, cashback_cap_snapshot: null, order_value: 1000, reward_points_snapshot: null },
  ];
  const summary = summarizeWallet(entries, withdrawals, cashbackAwards, pointAwards, conversions);
  assert.equal(summary.availableCashback, 700);
  assert.equal(summary.pendingCashback, 250);
  assert.equal(summary.trackingCashback, 120);
  assert.equal(summary.redeemablePoints, 1200);
  assert.equal(summary.pendingPoints, 300);
  assert.equal(summary.trackingPoints, 150);
  assert.equal(summary.tracking.length, 2);
});

test('rejected and reversed awards never contribute to available or pending points', () => {
  const awards = [
    { conversion_id: 'a', points: 100, status: 'rejected' },
    { conversion_id: 'b', points: 200, status: 'reversed' },
  ];
  const summary = summarizeWallet([], [], [], awards, []);
  assert.equal(summary.redeemablePoints, 0);
  assert.equal(summary.pendingPoints, 0);
});
