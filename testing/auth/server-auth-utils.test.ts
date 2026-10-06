import type { NextRequest } from 'next/server';

import { getToken } from 'next-auth/jwt';

import { getCurrentUser, isAdmin, withAuth, withAdmin, type AuthToken } from '@/lib/server-auth';
import { apiSuccess } from '@/lib/api-response';

import {
  mockAuthTokenUser,
  mockAuthTokenAdmin
} from '../../testing/mocks/auth.mock';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn()
}));

describe('Server Auth Utilities (lib/server-auth.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /*                              getCurrentUser                                */
  /* -------------------------------------------------------------------------- */
  describe('getCurrentUser', () => {
    const mockRequest = {
      url: 'http://localhost:3000/api/test',
      headers: new Headers()
    } as unknown as NextRequest;

    it('should return null if getToken returns null', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(null);

      const user = await getCurrentUser(mockRequest);

      expect(user).toBeNull();
      expect(getToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: expect.any(String)
      });
    });

    it('should return null if token is missing sub or email', async () => {
      // Missing sub
      (getToken as jest.Mock).mockResolvedValueOnce({
        email: 'test@example.com',
        role: 'USER'
      });
      const userWithoutSub = await getCurrentUser(mockRequest);
      expect(userWithoutSub).toBeNull();

      // Missing email
      (getToken as jest.Mock).mockResolvedValueOnce({
        sub: 'user-id',
        role: 'USER'
      });
      const userWithoutEmail = await getCurrentUser(mockRequest);
      expect(userWithoutEmail).toBeNull();
    });

    it('should return null if session is expired', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce({
        ...mockAuthTokenUser,
        sessionExpiresAt: Date.now() - 1000 * 60 // 1 minute in the past
      });

      const user = await getCurrentUser(mockRequest);

      expect(user).toBeNull();
    });

    it('should return valid AuthToken if token is valid and session is active', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);

      const user = await getCurrentUser(mockRequest);

      expect(user).toEqual(mockAuthTokenUser);
      expect(user?.email).toBe(mockAuthTokenUser.email);
      expect(user?.role).toBe(mockAuthTokenUser.role);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                 isAdmin                                    */
  /* -------------------------------------------------------------------------- */
  describe('isAdmin', () => {
    it('should return true when user role is ADMIN', () => {
      expect(isAdmin(mockAuthTokenAdmin)).toBe(true);
    });

    it('should return false when user role is USER', () => {
      expect(isAdmin(mockAuthTokenUser)).toBe(false);
    });

    it('should return false when user is null or undefined', () => {
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined as never)).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                withAuth                                    */
  /* -------------------------------------------------------------------------- */
  describe('withAuth wrapper', () => {
    const mockRequest = {
      url: 'http://localhost:3000/api/cart',
      headers: new Headers()
    } as unknown as Request;

    it('should reject unauthenticated request with 401', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(null);

      const handler = jest.fn(async () => apiSuccess('OK'));
      const wrapped = withAuth(handler);

      const response = await wrapped(mockRequest);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should inject user, userId, params, and context into handler for authenticated request', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);

      const handler = jest.fn(async ({ user, userId, context, params }: { user: AuthToken; userId: string; context: { params: Promise<{ id: string }> }; params: Promise<{ id: string }> }) => {
        return apiSuccess('OK', { user, userId, context, params });
      });
      const wrapped = withAuth(handler);

      const context = { params: Promise.resolve({ id: '123' }) };
      const response = await wrapped(mockRequest, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(handler).toHaveBeenCalledWith({
        request: mockRequest,
        user: mockAuthTokenUser,
        userId: mockAuthTokenUser.sub,
        context,
        params: context.params
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                withAdmin                                   */
  /* -------------------------------------------------------------------------- */
  describe('withAdmin wrapper', () => {
    const mockRequest = {
      url: 'http://localhost:3000/api/admin/dashboard',
      headers: new Headers()
    } as unknown as Request;

    it('should reject unauthenticated request with 401', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(null);

      const handler = jest.fn(async () => apiSuccess('OK'));
      const wrapped = withAdmin(handler);

      const response = await wrapped(mockRequest);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should reject non-admin authenticated user with 403 Forbidden', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);

      const handler = jest.fn(async () => apiSuccess('OK'));
      const wrapped = withAdmin(handler);

      const response = await wrapped(mockRequest);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Forbidden');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow admin user to execute handler', async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(mockAuthTokenAdmin);

      const handler = jest.fn(async () => apiSuccess('Admin Action Executed'));
      const wrapped = withAdmin(handler);

      const response = await wrapped(mockRequest);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

});

