import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizationStatus, requireAdminFromRequest, validOrigin } from '@/lib/auth';
import { getAllOpportunities, getOpportunityById, saveOpportunity } from '@/lib/repository';
import { validateOpportunity } from '@/lib/opportunities';
import type { Opportunity } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  return NextResponse.json(await getAllOpportunities());
}
export async function POST(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  const editor = access.user.email || access.user.id;
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const body = await request.text();
  if (body.length > 60000) return NextResponse.json({ error: 'La ficha excede el tamaño permitido.' }, { status: 413 });
  let input: Record<string, unknown>;
  try { input = JSON.parse(body); if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(); } catch { return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 }); }
  const str = (key: string) => typeof input[key] === 'string' ? (input[key] as string).trim().slice(0, 8000) : '';
  const list = (key: string) => Array.isArray(input[key]) ? (input[key] as unknown[]).filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 2000)).filter(Boolean).slice(0, 40) : [];
  const existing = str('id') ? await getOpportunityById(str('id')) : undefined;
  if (str('id') && !existing) return NextResponse.json({ error: 'La ficha ya no existe.' }, { status: 404 });
  const id = existing?.id || randomUUID();
  const slug = existing?.slug || `${str('title').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)}-${id.slice(0, 8)}`;
  const status = str('status') as Opportunity['status'];
  const publishing = status === 'published' || status === 'scheduled' || status === 'closed';
  const verified = input.verified === true;
  const opportunity: Opportunity = {
    id, slug, entity: str('entity'), entityShort: str('entityShort') || str('entity').slice(0, 14), title: str('title'),
    type: str('type') as Opportunity['type'], region: str('region'), modality: str('modality') as Opportunity['modality'], level: str('level'),
    careers: list('careers'), vacancies: Number(input.vacancies), closingDate: str('closingDate'), officialUrl: str('officialUrl'),
    summary: str('summary'), beforeApplying: str('beforeApplying'), requirements: list('requirements'), salary: str('salary'), status,
    verifiedAt: publishing && verified ? new Date().toISOString() : existing?.verifiedAt || '', verifiedBy: publishing && verified ? editor : existing?.verifiedBy || '',
    publishedAt: status === 'scheduled' ? str('publishedAt') : existing?.publishedAt || new Date().toISOString(),
    isDemo: existing?.isDemo === true && !verified, featured: input.featured === true, color: /^#[a-f\d]{6}$/i.test(str('color')) ? str('color') : '#245be8',
  };
  const errors = validateOpportunity(opportunity);
  if (publishing && !verified && !(status === 'closed' && existing?.verifiedBy)) errors.push('Confirma que revisaste las bases y la fuente oficial para publicar.');
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
  await saveOpportunity(opportunity);
  return NextResponse.json(opportunity);
}
