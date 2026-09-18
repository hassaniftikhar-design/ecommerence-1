import type { IncomingMessage } from 'http';

import { getToken } from 'next-auth/jwt';

import { isSessionExpired } from '@/constants';
import type { AuthToken } from '@/lib/server-auth';

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

/**
 * Server-side authentication for incoming Socket.IO handshake requests.
 * Extracts and verifies the NextAuth session token from request cookies.
 * Does NOT trust any unverified client-provided userId.
 */
export async function authenticateSocketRequest(
  req: IncomingMessage
): Promise<AuthToken | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.warn('[SocketAuth] Missing process.env.NEXTAUTH_SECRET');
      return null;
    }

    // Node.js http.IncomingMessage does not have parsed cookies by default.
    // NextAuth SessionStore requires req.cookies to find session token chunks.
    const reqWithCookies = req as IncomingMessage & { cookies?: Record<string, string> };
    if (!reqWithCookies.cookies && req.headers.cookie) {
      reqWithCookies.cookies = parseCookieHeader(req.headers.cookie);
    }

    const token = (await getToken({
      req: reqWithCookies as Parameters<typeof getToken>[0]['req'],
      secret
    })) as AuthToken | null;

    if (!token?.sub) {
      return null;
    }

    if (isSessionExpired(token.sessionExpiresAt)) {
      return null;
    }

    return token;
  } catch (error) {
    console.error('[SocketAuth] Failed to authenticate socket connection:', error);
    return null;
  }
}
