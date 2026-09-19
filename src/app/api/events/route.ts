import { NextResponse } from 'next/server';
import { validOrigin } from '@/lib/auth';
import { recordEvent } from '@/lib/repository';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const body = await request.text();
  if (body.length > 3000) return new NextResponse(null, { status: 413 });
  let data;
  try { data = JSON.parse(body); } catch { return new NextResponse(null, { status: 400 }); }
  if (!data || !['view', 'official_click', 'save'].includes(data.name)) return new NextResponse(null, { status: 400 });
  for (const key of ['opportunityId', 'source', 'medium', 'campaign', 'content']) if (data[key] !== undefined && typeof data[key] !== 'string') return new NextResponse(null, { status: 400 });
  await recordEvent(data);
  return new NextResponse(null, { status: 204 });
}
