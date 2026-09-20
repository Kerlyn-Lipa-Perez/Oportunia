import 'server-only';

import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appProfiles } from '@/lib/db/schema';
import { resolveAdminAccess } from '@/lib/authz';
import type { AdminAccess } from '@/lib/authz';

export { authorizationStatus, resolveAdminAccess, type AdminAccess, type SessionIdentity } from '@/lib/authz';

export const auth: NeonAuth = new Proxy({} as NeonAuth, {
  get(_target, prop) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop);
    if (typeof value === 'function') {
      return (value as (...args: never[]) => unknown).bind(instance);
    }
    return value;
  },
});

function createAuthClient(): NeonAuth {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl) {
    throw new Error(
      'NEON_AUTH_BASE_URL environment variable is required. ' +
        'Pull it with `neon env pull` or set it in the Vercel project environment.',
    );
  }
  if (!secret) {
    throw new Error(
      'NEON_AUTH_COOKIE_SECRET environment variable is required. ' +
        'Set a random value of at least 32 characters in the Vercel project environment.',
    );
  }
  return createNeonAuth({ baseUrl, cookies: { secret } });
}

// Lazy singleton — the client is created on first request, not at module
// import time. This lets `next build` collect route configuration without
// auth env vars present, mirroring the lazy pattern in `@/lib/db`.
let _auth: NeonAuth | null = null;

/** Request-time accessor for the Neon Auth client. Throws only when called without env vars. */
export function getAuth(): NeonAuth {
  if (!_auth) {
    _auth = createAuthClient();
  }
  return _auth;
}

async function findApplicationRole(userId: string): Promise<string | null> {
  const profile = await db
    .select({ role: appProfiles.role })
    .from(appProfiles)
    .where(eq(appProfiles.userId, userId))
    .limit(1);

  return profile[0]?.role ?? null;
}

/** Central DAL check for Server Components and route handlers. */
export async function requireAdmin(): Promise<AdminAccess> {
  const { data: session } = await getAuth().getSession();
  return resolveAdminAccess(session?.user ?? null, findApplicationRole);
}

/**
 * Route handlers use this explicit entry point so authorization remains next
 * to the protected mutation instead of relying on the client UI.
 */
export async function requireAdminFromRequest(_request: Request): Promise<AdminAccess> {
  return requireAdmin();
}

/** CSRF check for same-origin editor mutations; authentication is separate. */
export function validOrigin(request: Request) {
  const expected = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : new URL(request.url).origin;
  return request.headers.get('origin') === expected;
}
