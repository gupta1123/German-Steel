import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isTokenExpired(token: string | undefined): boolean {
  if (!token) return true;
  const parts = token.split('.');
  if (parts.length < 2) return true;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob !== 'function') return true;
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value;
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const invalidOrExpired = !token || isTokenExpired(token);

  if (isProtectedRoute && invalidOrExpired) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('authToken', '', { path: '/', maxAge: 0 });
    return response;
  }

  if (request.nextUrl.pathname === '/login' && token && !invalidOrExpired) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
