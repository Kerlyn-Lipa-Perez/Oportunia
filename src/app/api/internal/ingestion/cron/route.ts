import { NextResponse } from 'next/server';
import { getBearerToken, hasValidCronSecret } from '@/lib/ingestion/http';
import { runApprovedSources } from '@/lib/ingestion/admin';

export const runtime = 'nodejs';

async function run(request: Request) {
  if (!hasValidCronSecret(getBearerToken(request), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  return NextResponse.json(await runApprovedSources('cron'));
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
