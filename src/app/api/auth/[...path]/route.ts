import { getAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthRouteContext = { params: Promise<{ path: string[] }> };

async function rejectBrowserAdminApi(context: AuthRouteContext) {
  const { path } = await context.params;
  return path[0] === 'admin'
    ? Response.json({ error: 'Not found.' }, { status: 404 })
    : null;
}

async function forward(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', request: Request, context: AuthRouteContext) {
  const rejected = await rejectBrowserAdminApi(context);
  if (rejected) return rejected;
  return getAuth().handler()[method](request, context);
}

// Handlers are resolved per request (not at module scope) so `next build`
// can collect this route's configuration without auth env vars present.
export function GET(request: Request, context: AuthRouteContext) {
  return forward('GET', request, context);
}

export function POST(request: Request, context: AuthRouteContext) {
  return forward('POST', request, context);
}

export function PUT(request: Request, context: AuthRouteContext) {
  return forward('PUT', request, context);
}

export function DELETE(request: Request, context: AuthRouteContext) {
  return forward('DELETE', request, context);
}

export function PATCH(request: Request, context: AuthRouteContext) {
  return forward('PATCH', request, context);
}
