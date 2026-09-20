import { NextResponse } from 'next/server';
import { authorizationStatus, requireAdminFromRequest } from '@/lib/auth';
import { getIngestionHistory } from '@/lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  return NextResponse.json({ runs: await getIngestionHistory() }, { headers: { 'Cache-Control': 'no-store' } });
}
