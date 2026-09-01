import { NextResponse } from 'next/server';
import { createSimpleCaptcha } from '@/lib/security/simple-captcha';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() { const challenge = createSimpleCaptcha(); return challenge ? NextResponse.json(challenge, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Security check unavailable.' }, { status: 503 }); }
