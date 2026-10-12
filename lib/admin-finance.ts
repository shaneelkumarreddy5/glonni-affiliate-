export type ProviderCommission = {
  id: string; provider_id: string | null; commission_amount: number | string | null;
  currency: string; status: string; financial_validation_status: string;
  affiliate_providers: { name: string; adapter_key: string } | null;
};
export type CommissionSummary = { providerId: string | null; name: string; currency: string; reported: number; approved: number; pending: number; held: number; rejected: number; orders: number; unpricedOrders: number };

/** Provider-reported commissions are not proof of bank receipt or customer cashback. */
export function summarizeProviderCommissions(conversions: ProviderCommission[]): CommissionSummary[] {
  const groups = new Map<string, CommissionSummary>();
  for (const conversion of conversions) {
    const key = `${conversion.provider_id ?? 'unlinked'}:${conversion.currency}`;
    const group = groups.get(key) ?? { providerId: conversion.provider_id, name: conversion.affiliate_providers?.name || 'Provider not linked', currency: conversion.currency, reported: 0, approved: 0, pending: 0, held: 0, rejected: 0, orders: 0, unpricedOrders: 0 };
    const amount = Number(conversion.commission_amount);
    group.orders += 1;
    groups.set(key, group);
    if (conversion.commission_amount === null || !Number.isFinite(amount) || amount < 0) { group.unpricedOrders += 1; continue; }
    group.reported += amount;
    if (['rejected', 'cancelled'].includes(conversion.status) || conversion.financial_validation_status === 'rejected') group.rejected += amount;
    else if (conversion.financial_validation_status === 'held') group.held += amount;
    else if (conversion.status === 'confirmed' && conversion.financial_validation_status === 'approved') group.approved += amount;
    else group.pending += amount;
  }
  return [...groups.values()];
}

export function financeCsvCell(value: string | number) {
  let cell = String(value);
  if (/^[\s]*[=+@-]/.test(cell) && typeof value === 'string') cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}
