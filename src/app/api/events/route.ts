import { NextResponse } from 'next/server';
import { validOrigin } from '@/lib/auth';
import { AnonymousSessionRateLimiter, parseTrackableEventPayload } from '@/lib/event-tracking';
import { recordEvent } from '@/lib/repository';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new AnonymousSessionRateLimiter();

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  const body = await request.text();
  if (body.length > 3000) return new NextResponse(null, { status: 413 });
  let data;
  try { data = JSON.parse(body); } catch { return new NextResponse(null, { status: 400 }); }
  const event = parseTrackableEventPayload(data);
  if (!event) return new NextResponse(null, { status: 400 });
  if (event.sessionId && !limiter.accept(event.sessionId)) return new NextResponse(null, { status: 429 });
  await recordEvent(event);
  return new NextResponse(null, { status: 204 });
}
