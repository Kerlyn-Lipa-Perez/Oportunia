import type { SessionIdentity } from './authz';

export type TeamRole = 'admin' | 'editor';
export type NeonRole = 'admin' | 'user';
export type TeamStatus = 'active' | 'suspended' | 'unconfigured';

export type AuthDirectoryUser = {
  id: string;
  email: string;
  name: string;
  role?: string | string[] | null;
  banned?: boolean | null;
  createdAt?: string | Date;
};

export type TeamProfile = {
  userId: string;
  role: TeamRole;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamUser = {
  id: string;
  email: string;
  name: string;
  role: TeamRole | null;
  status: TeamStatus;
  isCurrent: boolean;
  createdAt: string | null;
};

export type TeamDependencies = {
  now: () => Date;
  auth: {
    listUsers(): Promise<AuthDirectoryUser[]>;
    createUser(input: { email: string; password: string; name: string; role: NeonRole }): Promise<AuthDirectoryUser>;
    setRole(userId: string, role: NeonRole): Promise<void>;
    banUser(userId: string): Promise<void>;
    unbanUser(userId: string): Promise<void>;
    revokeUserSessions(userId: string): Promise<void>;
  };
  profiles: {
    list(): Promise<TeamProfile[]>;
    get(userId: string): Promise<TeamProfile | null>;
    upsert(profile: TeamProfile): Promise<TeamProfile>;
  };
};

export type TeamErrorCode =
  | 'invalid_input'
  | 'invalid_password'
  | 'not_found'
  | 'self_management_forbidden'
  | 'last_active_admin'
  | 'profile_sync_failed'
  | 'auth_sync_failed';

export class TeamManagementError extends Error {
  constructor(public readonly code: TeamErrorCode, message: string, public readonly status = 400) {
    super(message);
    this.name = 'TeamManagementError';
  }
}

const roleInNeon = (role: TeamRole): NeonRole => role === 'admin' ? 'admin' : 'user';
const isTeamRole = (role: unknown): role is TeamRole => role === 'admin' || role === 'editor';
const iso = (value: string | Date | undefined) => value ? new Date(value).toISOString() : null;

export async function listTeamUsers(actor: SessionIdentity, dependencies: TeamDependencies): Promise<TeamUser[]> {
  const [identities, profiles] = await Promise.all([
    dependencies.auth.listUsers(),
    dependencies.profiles.list(),
  ]);
  const byUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  return identities.map((identity) => {
    const profile = byUserId.get(identity.id);
    const status: TeamStatus = !profile
      ? 'unconfigured'
      : profile.suspended || identity.banned
        ? 'suspended'
        : 'active';
    return {
      id: identity.id,
      email: identity.email,
      name: identity.name,
      role: profile?.role ?? null,
      status,
      isCurrent: identity.id === actor.id,
      createdAt: iso(identity.createdAt),
    };
  }).sort((left, right) => left.email.localeCompare(right.email, 'es'));
}

export async function createTeamUser(
  raw: { name: string; email: string; password: string; role: TeamRole },
  actor: SessionIdentity,
  dependencies: TeamDependencies,
): Promise<TeamUser> {
  const name = raw.name.trim();
  const email = raw.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || !isTeamRole(raw.role)) {
    throw new TeamManagementError('invalid_input', 'Nombre, correo o rol no válidos.');
  }
  if (raw.password.length < 12) {
    throw new TeamManagementError('invalid_password', 'La contraseña inicial debe tener al menos 12 caracteres.');
  }

  let identity: AuthDirectoryUser;
  try {
    identity = await dependencies.auth.createUser({ name, email, password: raw.password, role: roleInNeon(raw.role) });
  } catch {
    throw new TeamManagementError('auth_sync_failed', 'Neon Auth no pudo crear la cuenta.', 502);
  }

  const timestamp = dependencies.now().toISOString();
  try {
    await dependencies.profiles.upsert({
      userId: identity.id,
      role: raw.role,
      suspended: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch {
    try { await dependencies.auth.banUser(identity.id); } catch { /* fail closed best effort */ }
    try { await dependencies.auth.revokeUserSessions(identity.id); } catch { /* fail closed best effort */ }
    throw new TeamManagementError(
      'profile_sync_failed',
      'La identidad fue creada, pero quedó suspendida porque no se pudo asignar el perfil.',
      502,
    );
  }

  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
    role: raw.role,
    status: 'active',
    isCurrent: identity.id === actor.id,
    createdAt: iso(identity.createdAt),
  };
}

export async function updateTeamUser(
  raw: { userId: string; role?: TeamRole; active?: boolean },
  actor: SessionIdentity,
  dependencies: TeamDependencies,
): Promise<TeamUser> {
  const userId = raw.userId.trim();
  if (!userId || (raw.role === undefined && raw.active === undefined) || (raw.role !== undefined && raw.active !== undefined)) {
    throw new TeamManagementError('invalid_input', 'Enviá exactamente un cambio de rol o estado.');
  }
  if (raw.role !== undefined && !isTeamRole(raw.role)) {
    throw new TeamManagementError('invalid_input', 'Rol no válido.');
  }
  if (userId === actor.id) {
    throw new TeamManagementError('self_management_forbidden', 'No podés modificar ni suspender tu propia cuenta.', 409);
  }

  const [identities, profiles] = await Promise.all([dependencies.auth.listUsers(), dependencies.profiles.list()]);
  const identity = identities.find((user) => user.id === userId);
  if (!identity) throw new TeamManagementError('not_found', 'La cuenta ya no existe.', 404);
  const profile = profiles.find((item) => item.userId === userId) ?? null;
  const activeAdmins = profiles.filter((item) => {
    const user = identities.find((identityItem) => identityItem.id === item.userId);
    return item.role === 'admin' && !item.suspended && user && !user.banned;
  });
  const removesActiveAdmin = profile?.role === 'admin' && !profile.suspended && !identity.banned
    && (raw.role === 'editor' || raw.active === false);
  if (removesActiveAdmin && activeAdmins.length <= 1) {
    throw new TeamManagementError('last_active_admin', 'Debe quedar al menos un administrador activo.', 409);
  }

  const timestamp = dependencies.now().toISOString();
  if (raw.role !== undefined) {
    const nextProfile: TeamProfile = {
      userId,
      role: raw.role,
      suspended: profile?.suspended ?? false,
      createdAt: profile?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await dependencies.profiles.upsert(nextProfile);
    try {
      if (raw.role === 'editor') await dependencies.auth.revokeUserSessions(userId);
      await dependencies.auth.setRole(userId, roleInNeon(raw.role));
    } catch {
      throw new TeamManagementError(
        'auth_sync_failed',
        'El acceso de aplicación cambió, pero la sincronización de Neon Auth debe reintentarse.',
        502,
      );
    }
  } else if (raw.active === false) {
    if (profile) await dependencies.profiles.upsert({ ...profile, suspended: true, updatedAt: timestamp });
    try {
      await dependencies.auth.banUser(userId);
      await dependencies.auth.revokeUserSessions(userId);
    } catch {
      throw new TeamManagementError('auth_sync_failed', 'El acceso quedó bloqueado, pero Neon Auth debe sincronizarse.', 502);
    }
  } else {
    try { await dependencies.auth.unbanUser(userId); } catch {
      throw new TeamManagementError('auth_sync_failed', 'Neon Auth no pudo reactivar la cuenta.', 502);
    }
    if (profile) await dependencies.profiles.upsert({ ...profile, suspended: false, updatedAt: timestamp });
  }

  const updated = (await listTeamUsers(actor, dependencies)).find((user) => user.id === userId);
  if (!updated) throw new TeamManagementError('not_found', 'La cuenta ya no existe.', 404);
  return updated;
}
