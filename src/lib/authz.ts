export type SessionIdentity = { id: string; email?: string | null };
export type ApplicationRole = 'admin' | 'editor';
export type AuthorizationProfile = { role: string; suspended: boolean };
export type AdminAccess =
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'admin'; user: SessionIdentity };
export type EditorialAccess =
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'admin'; user: SessionIdentity }
  | { kind: 'editor'; user: SessionIdentity };

type ProfileLookup = (userId: string) => Promise<AuthorizationProfile | null | undefined>;

export async function resolveAdminAccess(
  user: SessionIdentity | null | undefined,
  findProfile: ProfileLookup,
): Promise<AdminAccess> {
  if (!user?.id) return { kind: 'unauthenticated' };
  const profile = await findProfile(user.id);
  return profile?.role === 'admin' && !profile.suspended
    ? { kind: 'admin', user }
    : { kind: 'forbidden' };
}

export async function resolveEditorialAccess(
  user: SessionIdentity | null | undefined,
  findProfile: ProfileLookup,
): Promise<EditorialAccess> {
  if (!user?.id) return { kind: 'unauthenticated' };
  const profile = await findProfile(user.id);
  if (profile?.suspended) return { kind: 'forbidden' };
  if (profile?.role === 'admin') return { kind: 'admin', user };
  if (profile?.role === 'editor') return { kind: 'editor', user };
  return { kind: 'forbidden' };
}

export function isEditorialAccess(access: EditorialAccess): access is Extract<EditorialAccess, { kind: 'admin' | 'editor' }> {
  return access.kind === 'admin' || access.kind === 'editor';
}

export function authorizationStatus(access: AdminAccess | EditorialAccess): 401 | 403 | 200 {
  return access.kind === 'unauthenticated' ? 401 : access.kind === 'forbidden' ? 403 : 200;
}
