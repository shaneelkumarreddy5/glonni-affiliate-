'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const serviceKeys = new Set(['voucher_purchase', 'bill_payment']);
const destination = '/admin/payment-providers';

async function requirePaymentAdmin() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user || assurance?.currentLevel !== 'aal2') redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active') {
    redirect('/admin/login');
  }
  return { supabase, user };
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export async function addPaymentProvider(formData: FormData) {
  const { supabase, user } = await requirePaymentAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const providerKeyInput = String(formData.get('providerKey') ?? '').trim();
  const providerKey = slug(providerKeyInput || name);
  const services = [...new Set(formData.getAll('services').map(String).filter((key) => serviceKeys.has(key)))];
  const priority = Number(formData.get('priority') ?? 100);
  if (name.length < 2 || name.length > 100 || providerKey.length < 2 || !services.length || !Number.isInteger(priority) || priority < 1 || priority > 9999) {
    redirect(`${destination}?notice=invalid`);
  }

  const { data, error } = await supabase.from('payment_provider_configs').insert({
    name,
    provider_key: providerKey,
    services,
    priority,
    created_by: user.id,
    updated_by: user.id,
  }).select('id').maybeSingle();
  if (error || !data) redirect(`${destination}?notice=save_failed`);

  await supabase.from('audit_events').insert({
    actor_id: user.id,
    event_type: 'payment_provider_added',
    entity_type: 'payment_provider',
    entity_id: data.id,
    source: 'admin_payment_providers',
    metadata: { provider_key: providerKey, services, priority },
  });
  revalidatePath(destination);
  redirect(`${destination}?notice=added`);
}

export async function setPaymentProviderEnabled(formData: FormData) {
  const { supabase, user } = await requirePaymentAdmin();
  const id = String(formData.get('id') ?? '');
  const enabled = formData.get('enabled') === 'true';
  if (!id) redirect(`${destination}?notice=invalid`);

  const { data, error } = await supabase.from('payment_provider_configs')
    .update({ enabled, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,provider_key,enabled')
    .maybeSingle();
  if (error || !data) {
    redirect(`${destination}?notice=${encodeURIComponent(error?.message ?? 'provider_not_found')}`);
  }
  await supabase.from('audit_events').insert({
    actor_id: user.id,
    event_type: enabled ? 'payment_provider_enable_attempt' : 'payment_provider_disabled',
    entity_type: 'payment_provider',
    entity_id: data.id,
    source: 'admin_payment_providers',
    metadata: { provider_key: data.provider_key, enabled: data.enabled },
  });
  revalidatePath(destination);
  redirect(`${destination}?notice=${data.enabled ? 'enabled' : 'disabled'}`);
}
