'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function owner() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in required'); return { supabase, user }; }
export async function removeSavedOffer(formData: FormData) { const { supabase, user } = await owner(); await supabase.from('saved_offers').delete().eq('profile_id', user.id).eq('offer_id', String(formData.get('offerId') || '')); revalidatePath('/saved-deals'); revalidatePath('/account'); }
export async function togglePriceAlert(formData: FormData) { const { supabase, user } = await owner(); const id = String(formData.get('id') || ''); const isActive = formData.get('isActive') === 'true'; await supabase.from('price_alerts').update({ is_active: !isActive, updated_at: new Date().toISOString() }).eq('id', id).eq('profile_id', user.id); revalidatePath('/price-alerts'); }
export async function removePriceAlert(formData: FormData) { const { supabase, user } = await owner(); await supabase.from('price_alerts').delete().eq('id', String(formData.get('id') || '')).eq('profile_id', user.id); revalidatePath('/price-alerts'); revalidatePath('/account'); }
