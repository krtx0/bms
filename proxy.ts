import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Optimistic auth check only (Next.js 16 renamed Middleware to Proxy — see AGENTS.md). Real
// authorization happens per-route via requireAuth() in lib/auth.ts; this just gives a fast
// redirect for page navigations so an unauthenticated visitor never sees a page flash before
// the client-side fetch would have failed.
const COOKIE_NAME = 'melange_session';
const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-only-secret-change-me');

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await hasValidSession(request);

  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // Public, unauthenticated intake form — the one page in (app)'s URL space that's deliberately
  // not gated. Its own API route (/api/public/orders) doesn't need an entry here since /api/* is
  // already outside this proxy's matcher entirely.
  if (pathname === '/order-form') return NextResponse.next();

  if (!authed) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
