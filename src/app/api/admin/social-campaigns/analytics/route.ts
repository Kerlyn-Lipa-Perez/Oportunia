import { NextResponse } from 'next/server';
import { authorizationStatus, isEditorialAccess, requireEditorialFromRequest } from '@/lib/auth';
import { getSocialCampaignAnalytics } from '@/lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export async function GET(request: Request) {
  const access = await requireEditorialFromRequest(request);
  if (!isEditorialAccess(access)) {
    return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  }

  const params = new URL(request.url).searchParams;
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = parseDate(rawFrom);
  const to = parseDate(rawTo);
  if ((rawFrom && !from) || (rawTo && !to) || (from && to && from > to)) {
    return NextResponse.json({ error: 'Rango de fechas no válido.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getSocialCampaignAnalytics({ from, to }));
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar la analítica.' }, { status: 500 });
  }
}
