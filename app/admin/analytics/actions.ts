'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function operator() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!user) redirect('/admin/login');
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('employees').select('status').eq('profile_id', user.id).single(),
  ]);
  if (!profile || !['owner', 'admin'].includes(profile.role) || employee?.status !== 'active' || assurance?.currentLevel !== 'aal2') throw new Error('An active Owner or Admin with 2FA is required.');
  return { supabase, user };
}

export async function scanAffiliateOperations() {
  const { supabase, user } = await operator();
  const { data, error } = await supabase.rpc('scan_affiliate_operations');
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: 'affiliate_operations_scanned', entity_type: 'affiliate_operations', source: 'admin', metadata: { alerts_detected: data ?? 0 } });
  revalidatePath('/admin/analytics');
}

export async function decideAffiliateAlert(formData: FormData) {
  const { supabase, user } = await operator();
  const alertId = String(formData.get('alertId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const { error } = await supabase.rpc('decide_affiliate_operation_alert', { p_alert_id: alertId, p_decision: decision, p_note: note || null });
  if (error) throw new Error(error.message);
  await supabase.from('audit_events').insert({ actor_id: user.id, event_type: `affiliate_alert_${decision}`, entity_type: 'affiliate_operation_alert', entity_id: alertId, source: 'admin', metadata: { note: note || null } });
  revalidatePath('/admin/analytics');
}
