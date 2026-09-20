import { timingSafeEqual } from 'node:crypto';

/**
 * Compares a presented cron bearer token without leaking equality through a
 * short-circuit string comparison. Empty configuration always rejects.
 */
export function hasValidCronSecret(presented: string | null, configured: string | undefined): boolean {
  if (!presented || !configured) return false;
  const actual = Buffer.from(presented);
  const expected = Buffer.from(configured);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}
