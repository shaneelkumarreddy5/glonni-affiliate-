import { createClient } from '@/lib/supabase/server';
import { readOperationalRows } from '@/lib/admin-operational-data';
import { summarizeProviderCommissions, type ProviderCommission } from '@/lib/admin-finance';

export async function getProviderCommissionReport() {
  const supabase = await createClient();
  const { rows, failed } = await readOperationalRows<ProviderCommission>(supabase, 'referral_conversions', 'id,provider_id,commission_amount,currency,status,financial_validation_status,affiliate_providers(name,adapter_key)');
  return { summaries: summarizeProviderCommissions(rows), conversions: rows, failed };
}
