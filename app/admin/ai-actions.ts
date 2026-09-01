'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const enc = (value: string) => encodeURIComponent(value);
async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const role = user?.app_metadata?.admin_role;
  if (!user || assurance?.currentLevel !== 'aal2' || role !== 'owner') redirect('/admin/login');
  return { supabase, user };
}

export async function decideAiWork(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const id = String(formData.get('workItemId') ?? '');
  const decision = String(formData.get('decision') ?? 'on_hold');
  const note = String(formData.get('note') ?? '').trim();
  if (!['approved', 'rejected', 'on_hold'].includes(decision)) redirect('/admin/approvals?error=Invalid+decision');
  const { error } = await supabase.from('ai_work_items').update({ status: decision, decision_note: note || null, decided_at: new Date().toISOString(), decided_by: user.id, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) redirect(`/admin/approvals?error=${enc(error.message)}`);
  await supabase.from('ai_work_events').insert({ work_item_id: id, event_type: `owner_${decision}`, actor_id: user.id, detail: { note } });
  revalidatePath('/admin/ai-agents'); revalidatePath('/admin/approvals'); revalidatePath('/admin/ads'); revalidatePath('/admin/social-accounts');
  redirect('/admin/approvals?success=Decision+recorded+and+audited.');
}

export async function addOwnerInstruction(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const instruction = String(formData.get('instruction') ?? '').trim();
  const scope = String(formData.get('scope') ?? 'all_agents');
  if (instruction.length < 3) redirect('/admin/ai-agents?error=Enter+a+clear+instruction.');
  const { error } = await supabase.from('ai_owner_instructions').insert({ instruction, scope, issued_by: user.id });
  if (error) redirect(`/admin/ai-agents?error=${enc(error.message)}`);
  revalidatePath('/admin/ai-agents'); redirect('/admin/ai-agents?success=Owner+instruction+saved+for+future+AI+workflows.');
}
