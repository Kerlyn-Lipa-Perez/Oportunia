import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'oportunia-editor';
export function authConfigured() { return !!(process.env.EDITOR_EMAIL && process.env.EDITOR_PASSWORD && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32); }
function same(a: string, b: string) { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); }
function sign(payload: string) { return createHmac('sha256', process.env.SESSION_SECRET || '').update(payload).digest('base64url'); }
export function checkCredentials(email: string, password: string) { return authConfigured() && same(email.trim().toLowerCase(), process.env.EDITOR_EMAIL!.toLowerCase()) && same(password, process.env.EDITOR_PASSWORD!); }
export async function createSession() {
  if (!authConfigured()) throw new Error('CMS no configurado');
  const payload = Buffer.from(JSON.stringify({ email: process.env.EDITOR_EMAIL, exp: Date.now() + 8 * 3600000 })).toString('base64url');
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 3600, path: '/' });
}
export async function getEditor(): Promise<string | null> {
  if (!authConfigured()) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !same(signature, sign(payload))) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() && data.email === process.env.EDITOR_EMAIL ? data.email : null; } catch { return null; }
}
export async function clearSession() { (await cookies()).delete(COOKIE); }
export function validOrigin(request: Request) {
  const expected = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : new URL(request.url).origin;
  return request.headers.get('origin') === expected;
}

const attempts = new Map<string, { count: number; until: number }>();
export function loginRateLimited(email: string) {
  for (const [oldKey, value] of attempts) if (value.until < Date.now()) attempts.delete(oldKey);
  const key = email.trim().toLowerCase();
  const entry = attempts.get(key);
  if (!entry && attempts.size >= 1000) return true;
  if (!entry || entry.until < Date.now()) { attempts.set(key, { count: 1, until: Date.now() + 15 * 60000 }); return false; }
  entry.count++;
  return entry.count > 10;
}
