import { NextResponse } from 'next/server';
import { authorizationStatus, isEditorialAccess, requireEditorialFromRequest, validOrigin } from '@/lib/auth';
import {
  createSocialCampaign,
  listSocialCampaigns,
  SocialCampaignRepositoryError,
  updateSocialCampaign,
} from '@/lib/repository';
import type { SocialCampaignStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses: readonly SocialCampaignStatus[] = ['draft', 'approved', 'queued', 'published', 'failed'];

function isStatus(value: unknown): value is SocialCampaignStatus {
  return typeof value === 'string' && (statuses as readonly string[]).includes(value);
}

function errorResponse(error: unknown) {
  if (error instanceof SocialCampaignRepositoryError) {
    const status = error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: 'No se pudo procesar la campaña social.' }, { status: 500 });
}

async function readObject(request: Request): Promise<Record<string, unknown> | NextResponse> {
  const body = await request.text();
  if (body.length > 20000) return NextResponse.json({ error: 'La campaña excede el tamaño permitido.' }, { status: 413 });
  try {
    const input: unknown = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    return input as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  }
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  if (!(key in input)) return undefined;
  if (typeof input[key] !== 'string') throw new SocialCampaignRepositoryError('invalid', `${key} debe ser texto.`);
  return input[key];
}

export async function GET(request: Request) {
  const access = await requireEditorialFromRequest(request);
  if (!isEditorialAccess(access)) {
    return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  }
  const requestedStatus = new URL(request.url).searchParams.get('status');
  let status: SocialCampaignStatus | undefined;
  if (requestedStatus) {
    if (!isStatus(requestedStatus)) {
      return NextResponse.json({ error: 'Estado de campaña no válido.' }, { status: 400 });
    }
    status = requestedStatus;
  }
  return NextResponse.json(await listSocialCampaigns(status));
}

export async function POST(request: Request) {
  const access = await requireEditorialFromRequest(request);
  if (!isEditorialAccess(access)) {
    return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  }
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const input = await readObject(request);
  if (input instanceof NextResponse) return input;

  try {
    const opportunityId = optionalString(input, 'opportunityId')?.trim() || '';
    if (!opportunityId) throw new SocialCampaignRepositoryError('invalid', 'La oportunidad es obligatoria.');
    const campaign = await createSocialCampaign({
      opportunityId,
      code: optionalString(input, 'code'),
      hook: optionalString(input, 'hook'),
      script: optionalString(input, 'script'),
      coverText: optionalString(input, 'coverText'),
      caption: optionalString(input, 'caption'),
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const access = await requireEditorialFromRequest(request);
  if (!isEditorialAccess(access)) {
    return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  }
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const input = await readObject(request);
  if (input instanceof NextResponse) return input;

  try {
    const id = optionalString(input, 'id')?.trim() || '';
    if (!id) throw new SocialCampaignRepositoryError('invalid', 'La campaña es obligatoria.');
    if ('status' in input && !isStatus(input.status)) {
      throw new SocialCampaignRepositoryError('invalid', 'Estado de campaña no válido.');
    }
    const actor = access.user.email || access.user.id;
    const campaign = await updateSocialCampaign({
      id,
      hook: optionalString(input, 'hook'),
      script: optionalString(input, 'script'),
      coverText: optionalString(input, 'coverText'),
      caption: optionalString(input, 'caption'),
      status: input.status as SocialCampaignStatus | undefined,
      publishedUrl: optionalString(input, 'publishedUrl'),
      failureReason: optionalString(input, 'failureReason'),
    }, actor);
    return NextResponse.json(campaign);
  } catch (error) {
    return errorResponse(error);
  }
}
