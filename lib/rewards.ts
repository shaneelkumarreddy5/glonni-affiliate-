export type RewardOffer = {
  reward_type?: string | null;
  cashback_amount?: number | null;
  cashback_percent?: number | null;
  cashback_cap?: number | null;
  coupon_code?: string | null;
  cashback_tracking_supported?: boolean | null;
};

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export function rewardLabel(offer: RewardOffer) {
  if (offer.reward_type === 'fixed_cashback' && (offer.cashback_amount ?? 0) > 0)
    return `Get ${money(offer.cashback_amount!)} Glonni Cashback`;
  if (offer.reward_type === 'percentage_cashback' && (offer.cashback_percent ?? 0) > 0)
    return `Get up to ${offer.cashback_percent}% Glonni Cashback${(offer.cashback_cap ?? 0) > 0 ? ` (max ${money(offer.cashback_cap!)})` : ''}`;
  if (offer.reward_type === 'coupon' && offer.coupon_code) return `Use code ${offer.coupon_code}`;
  if (offer.reward_type === 'merchant_promotion') return 'Merchant offer available';
  return 'Best available price';
}

export function hasCashback(offer: RewardOffer) {
  return offer.reward_type === 'fixed_cashback' || offer.reward_type === 'percentage_cashback';
}
