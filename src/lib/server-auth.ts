
import type { NextRequest } from 'next/server';

import { getToken } from 'next-auth/jwt';
import type { Role } from '@prisma/client';

import { isSessionExpired } from '@/constants';
import { apiError } from '@/lib/api-response';

const secret = process.env.NEXTAUTH_SECRET;

export type AuthToken = {
  id?: string;
  sub?: string;
  email?: string;
  role?: Role;
  rememberMe?: boolean;
  sessionExpiresAt?: number;
};

export async function getCurrentUser(
  request: Request | NextRequest
): Promise<AuthToken | null> {
  const token = (await getToken({
    req: request as unknown as NextRequest,
    secret
  })) as AuthToken | null;

  if (!token?.sub || !token?.email) {
    return null;
  }

  if (isSessionExpired(token.sessionExpiresAt)) {
    return null;
  }

  return token;
}

export function isAdmin(user: AuthToken | null): boolean {
  return user?.role === 'ADMIN';
}

export const authConfig = {
  getCurrentUser
};

export type AuthContext<TContext = undefined> = {
  request: Request;
  user: AuthToken;
  userId: string;
  context: TContext;
  params: TContext extends { params: infer P } ? P : undefined;
};

export type AuthenticatedHandler<TContext = undefined> = (
  ctx: AuthContext<TContext>
) => Promise<Response> | Response;

export type WithAuthReturn<TContext> = TContext extends undefined
  ? (request: Request) => Promise<Response>
  : (request: Request, context: TContext) => Promise<Response>;

/**
 * Route handler wrapper that enforces authenticated user session.
 * Injects a unified context object containing `request`, `user`, `userId`, `params`, and `context`.
 */
export function withAuth<TContext = undefined>(
  handler: AuthenticatedHandler<TContext>
): WithAuthReturn<TContext> {
  const routeHandler = async (request: Request, context?: TContext): Promise<Response> => {
    try {
      const user = await (authConfig.getCurrentUser || getCurrentUser)(request);
      const userId = user?.id || user?.sub;

      if (!user || !userId) {
        return apiError('Unauthorized', [], 401);
      }

      return await handler({
        request,
        user,
        userId,
        context: context as TContext,
        params: (context as { params?: unknown } | undefined)?.params as AuthContext<TContext>['params']
      });
    } catch (error) {
      return apiError(
        'An unexpected error occurred',
        [(error as Error).message || String(error)],
        500
      );
    }
  };

  return routeHandler as unknown as WithAuthReturn<TContext>;
}

/**
 * Route handler wrapper that enforces ADMIN role authorization.
 * Injects a unified context object containing `request`, `user`, `userId`, `params`, and `context`.
 */
export function withAdmin<TContext = undefined>(
  handler: AuthenticatedHandler<TContext>
): WithAuthReturn<TContext> {
  const routeHandler = async (request: Request, context?: TContext): Promise<Response> => {
    try {
      const user = await (authConfig.getCurrentUser || getCurrentUser)(request);
      const userId = user?.id || user?.sub;

      if (!user || !userId) {
        return apiError('Unauthorized', [], 401);
      }

      if (!isAdmin(user)) {
        return apiError('Forbidden: Admin access required', [], 403);
      }

      return await handler({
        request,
        user,
        userId,
        context: context as TContext,
        params: (context as { params?: unknown } | undefined)?.params as AuthContext<TContext>['params']
      });
    } catch (error) {
      return apiError(
        'An unexpected error occurred',
        [(error as Error).message || String(error)],
        500
      );
    }
  };

  return routeHandler as unknown as WithAuthReturn<TContext>;
}


