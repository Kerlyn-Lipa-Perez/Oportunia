import { NextResponse } from 'next/server';
import { authorizationStatus, isEditorialAccess, requireEditorialFromRequest } from '@/lib/auth';
import { createOpportunityTemplate } from '@/lib/ingestion/excel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await requireEditorialFromRequest(request);
  if (!isEditorialAccess(access)) return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  const file = createOpportunityTemplate();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-oportunia.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
