import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appProfiles } from '@/lib/db/schema';
import { resolveAdminAccess } from '@/lib/authz';
import type { AdminAccess } from '@/lib/authz';

export { authorizationStatus, resolveAdminAccess, type AdminAccess, type SessionIdentity } from '@/lib/authz';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});

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
  const { data: session } = await auth.getSession();
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
