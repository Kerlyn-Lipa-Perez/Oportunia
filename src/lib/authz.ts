export type SessionIdentity = { id: string; email?: string | null };
export type AdminAccess =
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'admin'; user: SessionIdentity };

type RoleLookup = (userId: string) => Promise<string | null | undefined>;

export async function resolveAdminAccess(
  user: SessionIdentity | null | undefined,
  findRole: RoleLookup,
): Promise<AdminAccess> {
  if (!user?.id) return { kind: 'unauthenticated' };
  return (await findRole(user.id)) === 'admin'
    ? { kind: 'admin', user }
    : { kind: 'forbidden' };
}

export function authorizationStatus(access: AdminAccess): 401 | 403 | 200 {
  return access.kind === 'unauthenticated' ? 401 : access.kind === 'forbidden' ? 403 : 200;
}
