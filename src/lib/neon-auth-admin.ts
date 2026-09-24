import 'server-only';

import { getAuth } from '@/lib/auth';
import type { AuthDirectoryUser, NeonRole, TeamDependencies } from '@/lib/team-management';

type AuthResult<T> = { data?: T | null; error?: { message?: string; code?: string } | null };

function requireData<T>(result: AuthResult<T>, operation: string): T {
  if (result.error || !result.data) throw new Error(`Neon Auth ${operation} failed.`);
  return result.data;
}

function normalizeUser(value: unknown): AuthDirectoryUser {
  const user = value as Record<string, unknown>;
  return {
    id: String(user.id || ''),
    email: String(user.email || ''),
    name: String(user.name || ''),
    role: Array.isArray(user.role) ? user.role.map(String) : typeof user.role === 'string' ? user.role : null,
    banned: user.banned === true,
    createdAt: user.createdAt instanceof Date || typeof user.createdAt === 'string' ? user.createdAt : undefined,
  };
}

export const neonAuthAdmin: TeamDependencies['auth'] = {
  async listUsers() {
    const result = await getAuth().admin.listUsers({
      query: { limit: 200, offset: 0, sortBy: 'name', sortDirection: 'asc' },
    });
    return requireData(result, 'listUsers').users.map(normalizeUser);
  },
  async createUser(input) {
    const result = await getAuth().admin.createUser(input);
    return normalizeUser(requireData(result, 'createUser').user);
  },
  async setRole(userId: string, role: NeonRole) {
    const result = await getAuth().admin.setRole({ userId, role });
    requireData(result, 'setRole');
  },
  async banUser(userId: string) {
    const result = await getAuth().admin.banUser({ userId, banReason: 'Cuenta suspendida desde Oportunia.' });
    requireData(result, 'banUser');
  },
  async unbanUser(userId: string) {
    const result = await getAuth().admin.unbanUser({ userId });
    requireData(result, 'unbanUser');
  },
  async revokeUserSessions(userId: string) {
    const result = await getAuth().admin.revokeUserSessions({ userId });
    requireData(result, 'revokeUserSessions');
  },
};
