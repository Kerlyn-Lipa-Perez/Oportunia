import { NextResponse } from 'next/server';
import { authorizationStatus, requireAdminFromRequest, validOrigin } from '@/lib/auth';
import { confirmExcelImport } from '@/lib/ingestion/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function workbookFromRequest(request: Request): Promise<ArrayBuffer> {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Adjunta un archivo .xlsx.');
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo no puede superar 10 MB.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('El archivo debe tener formato .xlsx.');
  return file.arrayBuffer();
}

export async function POST(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  try {
    return NextResponse.json(await confirmExcelImport(await workbookFromRequest(request)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo importar el archivo.' }, { status: 400 });
  }
}
