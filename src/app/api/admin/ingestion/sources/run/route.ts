import { NextResponse } from 'next/server';
import { authorizationStatus, requireAdminFromRequest, validOrigin } from '@/lib/auth';
import { runApprovedSources } from '@/lib/ingestion/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  return NextResponse.json(await runApprovedSources('manual'));
}
