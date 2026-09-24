import { NextResponse } from 'next/server';
import { authorizationStatus, requireAdminFromRequest, validOrigin, validReadOrigin } from '@/lib/auth';
import { neonAuthAdmin } from '@/lib/neon-auth-admin';
import {
  createTeamUser,
  listTeamUsers,
  TeamManagementError,
  updateTeamUser,
  type TeamDependencies,
  type TeamRole,
} from '@/lib/team-management';
import { teamProfileRepository } from '@/lib/team-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const dependencies: TeamDependencies = {
  now: () => new Date(),
  auth: neonAuthAdmin,
  profiles: teamProfileRepository,
};

function failure(error: unknown) {
  if (error instanceof TeamManagementError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: 'No se pudo gestionar la cuenta.' }, { status: 500 });
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.text();
  if (body.length > 10000) throw new TeamManagementError('invalid_input', 'La solicitud excede el tamaño permitido.', 413);
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new TeamManagementError('invalid_input', 'Datos no válidos.');
  }
}

export async function GET(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  if (!validReadOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  try {
    return NextResponse.json({ users: await listTeamUsers(access.user, dependencies) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  try {
    const input = await readObject(request);
    const user = await createTeamUser({
      name: typeof input.name === 'string' ? input.name : '',
      email: typeof input.email === 'string' ? input.email : '',
      password: typeof input.password === 'string' ? input.password : '',
      role: input.role as TeamRole,
    }, access.user, dependencies);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const access = await requireAdminFromRequest(request);
  if (access.kind !== 'admin') return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: authorizationStatus(access) });
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  try {
    const input = await readObject(request);
    const user = await updateTeamUser({
      userId: typeof input.userId === 'string' ? input.userId : '',
      role: input.role as TeamRole | undefined,
      active: typeof input.active === 'boolean' ? input.active : undefined,
    }, access.user, dependencies);
    return NextResponse.json({ user });
  } catch (error) {
    return failure(error);
  }
}
