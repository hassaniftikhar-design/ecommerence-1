/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: {
      get: (key: string) => string | null;
      set: (key: string, value: string) => void;
      has: (key: string) => boolean;
      delete: (key: string) => void;
    };
    private _data: any;
    private _headerMap: Map<string, string>;

    constructor(data?: any, init?: { status?: number; headers?: any }) {
      this._data = data;
      this.status = init?.status ?? 200;
      this._headerMap = new Map();
      if (init?.headers) {
        if (typeof init.headers.forEach === 'function') {
          init.headers.forEach((v: string, k: string) => this._headerMap.set(k.toLowerCase(), v));
        } else if (typeof init.headers === 'object') {
          Object.entries(init.headers).forEach(([k, v]) => this._headerMap.set(k.toLowerCase(), String(v)));
        }
      }
      this.headers = {
        get: (key: string) => this._headerMap.get(key.toLowerCase()) ?? null,
        set: (key: string, value: string) => this._headerMap.set(key.toLowerCase(), value),
        has: (key: string) => this._headerMap.has(key.toLowerCase()),
        delete: (key: string) => this._headerMap.delete(key.toLowerCase())
      };
    }

    async json() {
      return this._data;
    }

    static json(data: any, init?: { status?: number; headers?: any }) {
      return new MockNextResponse(data, init);
    }

    static redirect(url: string | URL, status = 307) {
      const res = new MockNextResponse(null, { status });
      res.headers.set('location', url.toString());
      return res;
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class MockNextRequest {}
  };
});

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn()
}));

jest.mock('@/server/services/auth.service', () => ({
  signupUserServer: jest.fn(),
  forgotPasswordServer: jest.fn(),
  validateResetTokenServer: jest.fn(),
  resetPasswordServer: jest.fn(),
  changePasswordServer: jest.fn(),
  verifyEmailServer: jest.fn()
}));

jest.mock('@/lib/server-auth', () => ({
  getCurrentUser: jest.fn()
}));

import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { POST as forgotPasswordHandler } from '@/app/api/auth/forgot-password/route';
import {
  GET as resetPasswordGetHandler,
  POST as resetPasswordPostHandler
} from '@/app/api/auth/reset-password/route';
import { POST as changePasswordHandler } from '@/app/api/auth/change-password/route';
import { GET as verifyEmailHandler } from '@/app/api/auth/verify-email/route';

import {
  signupUserServer,
  forgotPasswordServer,
  validateResetTokenServer,
  resetPasswordServer,
  changePasswordServer,
  verifyEmailServer
} from '@/server/services/auth.service';
import { getCurrentUser } from '@/lib/server-auth';

import {
  mockRegularUser,
  mockAuthTokenUser,
  mockSignupPayload,
  mockForgotPasswordPayload,
  mockResetPasswordPayload,
  mockChangePasswordPayload
} from '../mocks/auth.mock';

function createMockRequest(url: string, method = 'GET', body?: unknown): Request {
  return {
    url,
    method,
    json: jest.fn().mockResolvedValue(body)
  } as unknown as Request;
}

describe('Auth API Route Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /*                            POST /api/auth/signup                           */
  /* -------------------------------------------------------------------------- */
  describe('POST /api/auth/signup', () => {
    it('should return 201 when user is created successfully', async () => {
      (signupUserServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 201,
        user: {
          id: mockRegularUser.id,
          name: mockRegularUser.name,
          email: mockRegularUser.email,
          phone: mockRegularUser.phone,
          role: mockRegularUser.role,
          createdAt: mockRegularUser.createdAt
        },
        message: 'Account created successfully'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/signup',
        'POST',
        mockSignupPayload
      );

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Account created successfully');
      expect(data.data.user.email).toBe(mockRegularUser.email);
    });

    it('should return 409 when user email already exists', async () => {
      (signupUserServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 409,
        errors: [],
        message: 'A user with this email already exists'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/signup',
        'POST',
        mockSignupPayload
      );

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toBe('A user with this email already exists');
    });

    it('should return 500 when unexpected exception occurs', async () => {
      (signupUserServer as jest.Mock).mockRejectedValueOnce(
        new Error('Unexpected DB Crash')
      );

      const request = createMockRequest(
        'http://localhost:3000/api/auth/signup',
        'POST',
        mockSignupPayload
      );

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain('internal server error occurred');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                       POST /api/auth/forgot-password                       */
  /* -------------------------------------------------------------------------- */
  describe('POST /api/auth/forgot-password', () => {
    it('should return 200 when reset instructions are sent', async () => {
      (forgotPasswordServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 200,
        message: 'Password reset instructions have been sent to your email.'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/forgot-password',
        'POST',
        mockForgotPasswordPayload
      );

      const response = await forgotPasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('sent to your email');
    });

    it('should return 404 when email is not found (existing API user enumeration behavior)', async () => {
      (forgotPasswordServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 404,
        errors: [],
        message: 'This email does not exist in our Store.'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/forgot-password',
        'POST',
        mockForgotPasswordPayload
      );

      const response = await forgotPasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.message).toBe('This email does not exist in our Store.');
    });

    it('should return 500 when forgot-password server service throws unexpected exception', async () => {
      (forgotPasswordServer as jest.Mock).mockRejectedValueOnce(new Error('Unexpected mailer crash'));

      const request = createMockRequest(
        'http://localhost:3000/api/auth/forgot-password',
        'POST',
        mockForgotPasswordPayload
      );

      const response = await forgotPasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        GET /api/auth/reset-password                        */
  /* -------------------------------------------------------------------------- */
  describe('GET /api/auth/reset-password (Validate Token)', () => {
    it('should return 200 when reset token is valid', async () => {
      (validateResetTokenServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 200,
        message: 'Reset token is valid',
        data: { valid: true }
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/reset-password?token=valid-token',
        'GET'
      );

      const response = await resetPasswordGetHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.valid).toBe(true);
    });

    it('should return 400 when reset token is invalid or expired', async () => {
      (validateResetTokenServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 400,
        errors: [],
        message: 'This password reset link has expired.'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/reset-password?token=expired-token',
        'GET'
      );

      const response = await resetPasswordGetHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('This password reset link has expired.');
    });

    it('should return 500 when validate token service throws unexpected exception', async () => {
      (validateResetTokenServer as jest.Mock).mockRejectedValueOnce(new Error('DB failure'));

      const request = createMockRequest(
        'http://localhost:3000/api/auth/reset-password?token=some-token',
        'GET'
      );

      const response = await resetPasswordGetHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                       POST /api/auth/reset-password                        */
  /* -------------------------------------------------------------------------- */
  describe('POST /api/auth/reset-password', () => {
    it('should return 200 when password is reset successfully', async () => {
      (resetPasswordServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 200,
        message: 'Password changed successfully'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/reset-password',
        'POST',
        mockResetPasswordPayload
      );

      const response = await resetPasswordPostHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password changed successfully');
    });

    it('should return 400 when reset password fails validation or token invalid', async () => {
      (resetPasswordServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 400,
        errors: [],
        message: 'The reset link is invalid or has expired'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/reset-password',
        'POST',
        mockResetPasswordPayload
      );

      const response = await resetPasswordPostHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('The reset link is invalid or has expired');
    });

    it('should return 500 when reset password service throws unexpected exception', async () => {
      (resetPasswordServer as jest.Mock).mockRejectedValueOnce(new Error('Unexpected DB crash'));

      const request = createMockRequest(
        'http://localhost:3000/api/auth/reset-password',
        'POST',
        mockResetPasswordPayload
      );

      const response = await resetPasswordPostHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                       POST /api/auth/change-password                       */
  /* -------------------------------------------------------------------------- */
  describe('POST /api/auth/change-password', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(null);

      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        'POST',
        mockChangePasswordPayload
      );

      const response = await changePasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return 200 when authenticated user changes password', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);
      (changePasswordServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 200,
        message: 'Password updated successfully'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        'POST',
        mockChangePasswordPayload
      );

      const response = await changePasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password updated successfully');
      expect(changePasswordServer).toHaveBeenCalledWith(
        mockAuthTokenUser.sub,
        mockChangePasswordPayload
      );
    });

    it('should return 400 when current password is incorrect', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);
      (changePasswordServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 400,
        errors: [],
        message: 'Incorrect current password'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        'POST',
        mockChangePasswordPayload
      );

      const response = await changePasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Incorrect current password');
    });

    it('should return 500 when change password service throws unexpected exception', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);
      (changePasswordServer as jest.Mock).mockRejectedValueOnce(new Error('Unexpected DB crash'));

      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        'POST',
        mockChangePasswordPayload
      );

      const response = await changePasswordHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        GET /api/auth/verify-email                          */
  /* -------------------------------------------------------------------------- */
  describe('GET /api/auth/verify-email', () => {
    it('should return 200 when email is successfully verified', async () => {
      (verifyEmailServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 200,
        message: 'Email verified successfully'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/verify-email?token=valid-verification-token',
        'GET'
      );

      const response = await verifyEmailHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Email verified successfully');
    });

    it('should return 400 when verification token is invalid or expired', async () => {
      (verifyEmailServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 400,
        errors: [],
        message: 'Invalid or expired verification token'
      });

      const request = createMockRequest(
        'http://localhost:3000/api/auth/verify-email?token=expired-token',
        'GET'
      );

      const response = await verifyEmailHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid or expired verification token');
    });

    it('should return 500 when verify email service throws unexpected exception', async () => {
      (verifyEmailServer as jest.Mock).mockRejectedValueOnce(new Error('Unexpected DB crash'));

      const request = createMockRequest(
        'http://localhost:3000/api/auth/verify-email?token=some-token',
        'GET'
      );

      const response = await verifyEmailHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});

/* eslint-enable @typescript-eslint/no-explicit-any */

