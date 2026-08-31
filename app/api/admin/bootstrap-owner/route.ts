import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('admin-invite-user', {
    body: { mode: 'bootstrap_owner', email: 'admin@glonni.com' },
  });
  if (error || data?.error) return NextResponse.json({ ok: false, error: data?.error ?? error?.message ?? 'Owner invitation failed.' }, { status: 400 });
  return NextResponse.json({ ok: true, message: 'Owner invitation sent.' });
}
