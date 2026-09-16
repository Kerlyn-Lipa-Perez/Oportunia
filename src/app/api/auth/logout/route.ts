import { NextResponse } from 'next/server';
import { clearSession, validOrigin } from '@/lib/auth';
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  await clearSession();
  return NextResponse.json({ ok: true });
}
