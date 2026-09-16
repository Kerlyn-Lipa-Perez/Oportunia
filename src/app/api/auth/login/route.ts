import { NextResponse } from 'next/server';
import { authConfigured, checkCredentials, createSession, loginRateLimited, validOrigin } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!authConfigured()) return NextResponse.json({ error: 'Configurá las credenciales editoriales en .env.local.' }, { status: 503 });
  const body = await request.text();
  if (body.length > 2000) return NextResponse.json({ error: 'Datos demasiado extensos.' }, { status: 413 });
  let data;
  try { data = JSON.parse(body); } catch { return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 }); }
  if (!data || typeof data.email !== 'string' || typeof data.password !== 'string') return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 });
  if (data.email.length > 254 || data.password.length > 1024) return NextResponse.json({ error: 'Datos demasiado extensos.' }, { status: 413 });
  if (loginRateLimited(data.email)) return NextResponse.json({ error: 'Demasiados intentos. Volvé a intentar en 15 minutos.' }, { status: 429 });
  if (!checkCredentials(data.email, data.password)) return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
  await createSession();
  return NextResponse.json({ ok: true });
}
