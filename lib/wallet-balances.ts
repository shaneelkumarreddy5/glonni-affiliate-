export type WalletEntryBalance = { amount: number | string; entry_type: string };
export type WithdrawalBalance = { amount: number | string; status: string };
export type CashbackAwardBalance = { conversion_id: string; amount: number | string; status: string };
export type PointAwardBalance = { conversion_id: string; points: number | string; status: string };
export type ConversionBalance = { id: string; status: string; reward_type_snapshot: string | null; reward_points_snapshot: number | null; cashback_fixed_snapshot: number | null; cashback_percent_snapshot: number | null; cashback_cap_snapshot: number | null; order_value: number | null };

const total = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((sum, row) => sum + value(row), 0);
const outstanding = new Set(['requested', 'on_hold', 'approved', 'batched', 'processing']);

export function estimateTrackedCashback(row: ConversionBalance) {
  if (row.reward_type_snapshot === 'fixed_cashback') return Math.max(0, Number(row.cashback_fixed_snapshot ?? 0));
  if (row.reward_type_snapshot === 'percentage_cashback') {
    const estimate = Number(row.order_value ?? 0) * Number(row.cashback_percent_snapshot ?? 0) / 100;
    return Math.max(0, row.cashback_cap_snapshot ? Math.min(estimate, Number(row.cashback_cap_snapshot)) : estimate);
  }
  return 0;
}

export function summarizeWallet<T extends ConversionBalance>(entries: WalletEntryBalance[], withdrawals: WithdrawalBalance[], cashbackAwards: CashbackAwardBalance[], pointAwards: PointAwardBalance[], conversions: T[]) {
  const ledger = total(entries.filter(entry => entry.entry_type !== 'cashback_pending'), entry => Number(entry.amount));
  const reserved = total(withdrawals.filter(item => outstanding.has(item.status)), item => Number(item.amount));
  const awardedConversions = new Set([...cashbackAwards.map(item => item.conversion_id), ...pointAwards.map(item => item.conversion_id)]);
  const tracking = conversions.filter(item => !awardedConversions.has(item.id) && item.status === 'pending');
  return {
    availableCashback: Math.max(0, ledger - reserved),
    pendingCashback: total(cashbackAwards.filter(item => ['pending', 'held'].includes(item.status)), item => Number(item.amount)),
    trackingCashback: total(tracking, estimateTrackedCashback),
    redeemablePoints: total(pointAwards.filter(item => item.status === 'confirmed'), item => Number(item.points)),
    pendingPoints: total(pointAwards.filter(item => ['pending', 'held'].includes(item.status)), item => Number(item.points)),
    trackingPoints: total(tracking.filter(item => item.reward_type_snapshot === 'points'), item => Number(item.reward_points_snapshot ?? 0)),
    tracking,
  };
}
