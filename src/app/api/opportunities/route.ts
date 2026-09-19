import { NextResponse } from 'next/server';
import { getPublicOpportunities } from '@/lib/repository';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(await getPublicOpportunities(), { headers: { 'Cache-Control': 'no-store' } }); }
