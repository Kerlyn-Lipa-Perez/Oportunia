import { NextResponse } from 'next/server';
import { getPublicOpportunities } from '@/lib/repository';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(getPublicOpportunities(), { headers: { 'Cache-Control': 'no-store' } }); }
