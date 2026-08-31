import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!configured) {
    return NextResponse.json(
      { status: 'degraded', checks: { application: true, database: false }, mode: 'read-only-preview' },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('categories').select('id').limit(1);
    const healthy = !error;
    return NextResponse.json(
      { status: healthy ? 'ok' : 'degraded', checks: { application: true, database: healthy }, mode: 'read-only-preview' },
      { status: healthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', checks: { application: true, database: false }, mode: 'read-only-preview' },
      { status: 503 },
    );
  }
}
