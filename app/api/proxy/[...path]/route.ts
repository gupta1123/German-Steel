import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UPSTREAM_BASE = (process.env.API_PROXY_TARGET || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081').replace(/\/$/, '');

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const resolvedParams = await params;
    const path = (resolvedParams.path || []).join('/');
    const search = request.nextUrl.search || '';
    const targetUrl = `${UPSTREAM_BASE}/${path}${search}`;

    // Read cookie token and prefer it for Authorization
    const cookieStore = await cookies();
    const authToken = cookieStore.get('authToken')?.value;

    // Build headers to upstream
    const incomingHeaders = new Headers(request.headers);
    const headers: HeadersInit = {};

    // Pass through content-type and accept if present
    const contentType = incomingHeaders.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;
    const accept = incomingHeaders.get('accept');
    if (accept) headers['Accept'] = accept;

    // Set Authorization header - prioritize incoming header, fallback to cookie
    const incomingAuth = incomingHeaders.get('authorization');
    if (incomingAuth) {
      headers['Authorization'] = incomingAuth;
    } else if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Copy body for non-GET/HEAD
    const method = request.method.toUpperCase();
    let body: BodyInit | undefined = undefined;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      // Preserve raw body
      const arrayBuffer = await request.arrayBuffer();
      body = arrayBuffer;
    }

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
      // Do not forward cookies automatically
      redirect: 'manual',
    });

    // If upstream tries to redirect (e.g., to /login), surface as 401 instead of redirect to avoid client CORS/preflight issues
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      return NextResponse.json(
        { error: 'Unauthorized or redirected by upstream' },
        { status: 401 }
      );
    }

    // Stream response back with headers
    const resHeaders = new Headers();
    // Whitelist essential headers
    const contentTypeResp = upstreamResponse.headers.get('content-type');
    if (contentTypeResp) resHeaders.set('Content-Type', contentTypeResp);
    const cacheControl = upstreamResponse.headers.get('cache-control');
    if (cacheControl) resHeaders.set('Cache-Control', cacheControl);

    // Same-origin; CORS headers are not required, but harmless
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Vary', 'Origin');

    const bodyStream = upstreamResponse.body;
    if (!bodyStream) {
      return new NextResponse(null, { status: upstreamResponse.status, headers: resHeaders });
    }
    return new NextResponse(bodyStream, { status: upstreamResponse.status, headers: resHeaders });
  } catch (err) {
    console.error('Proxy error:', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
