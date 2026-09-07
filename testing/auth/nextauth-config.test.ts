/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/lib/prisma', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma
}));

jest.mock('openid-client', () => ({}));

jest.mock('next-auth/providers/google', () => {
  return {
    __esModule: true,
    default: jest.fn((options) => ({
      id: 'google',
      name: 'Google',
      type: 'oauth',
      options
    }))
  };
});

jest.mock('next-auth/providers/facebook', () => {
  return {
    __esModule: true,
    default: jest.fn((options) => ({
      id: 'facebook',
      name: 'Facebook',
      type: 'oauth',
      options
    }))
  };
});

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}));

// Mock bcryptjs compare
jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockImplementation(async (plain: string, hashed: string) => {
    return plain === 'Password123!' && !hashed.includes('invalid');
  })
}));

import { compare } from 'bcryptjs';

import { authOptions } from '@/lib/auth';

import {
  SESSION_DURATION_REMEMBER_ME_MS,
  SESSION_DURATION_DEFAULT_MS
} from '@/constants';

import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import {
  mockRegularUser,
  mockInactiveUser,
  mockGoogleUser,
  mockAuthTokenUser
} from '../mocks/auth.mock';

describe('NextAuth Configuration & Callbacks (lib/auth.ts)', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
  });

  const getCredentialsAuthorize = () => {
    const cred = authOptions.providers.find(
      (p: any) => p.id === 'credentials' || p.name === 'Credentials'
    ) as any;
    return cred?.options?.authorize || cred?.authorize;
  };

  /* -------------------------------------------------------------------------- */
  /*                       CREDENTIALS PROVIDER: AUTHORIZE                      */
  /* -------------------------------------------------------------------------- */
  describe('CredentialsProvider.authorize', () => {
    it('should return null if credentials are missing or incomplete', async () => {
      const authorize = getCredentialsAuthorize();
      const result1 = await authorize(undefined, {} as any);
      const result2 = await authorize({ email: 'john@example.com' } as any, {} as any);
      const result3 = await authorize({ password: 'Password123!' } as any, {} as any);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should normalize email casing to lowercase during authorize lookup', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await authorize(
        { email: 'JOHN@EXAMPLE.COM', password: 'Password123!' } as any,
        {} as any
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' }
      });
      expect(result).not.toBeNull();
      expect(result?.email).toBe(mockRegularUser.email);
    });

    it('should return null if user does not exist in database', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await authorize(
        { email: 'nonexistent@example.com', password: 'Password123!' } as any,
        {} as any
      );

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' }
      });
    });

    it('should return null if user is inactive', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockInactiveUser);

      const result = await authorize(
        { email: mockInactiveUser.email, password: 'Password123!' } as any,
        {} as any
      );

      expect(result).toBeNull();
    });

    it('should return null if user has no password set (e.g. OAuth-only user)', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockGoogleUser);

      const result = await authorize(
        { email: mockGoogleUser.email, password: 'Password123!' } as any,
        {} as any
      );

      expect(result).toBeNull();
    });

    it('should return null if password comparison fails', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await authorize(
        { email: mockRegularUser.email, password: 'WrongPassword' } as any,
        {} as any
      );

      expect(result).toBeNull();
    });

    it('should throw when database query fails during credentials authorize', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('Database offline'));

      await expect(
        authorize({ email: 'user@example.com', password: 'Password123!' } as any, {} as any)
      ).rejects.toThrow('Database offline');
    });

    it('should return user object with rememberMe: true when rememberMe is \'true\' or \'1\'', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await authorize(
        {
          email: mockRegularUser.email,
          password: 'Password123!',
          rememberMe: 'true'
        } as any,
        {} as any
      );

      expect(result).toEqual({
        id: mockRegularUser.id,
        name: mockRegularUser.name,
        email: mockRegularUser.email,
        role: mockRegularUser.role,
        rememberMe: true
      });
    });

    it('should return user object with rememberMe: false when rememberMe is unchecked', async () => {
      const authorize = getCredentialsAuthorize();
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await authorize(
        {
          email: mockRegularUser.email,
          password: 'Password123!',
          rememberMe: 'false'
        } as any,
        {} as any
      );

      expect(result).toEqual({
        id: mockRegularUser.id,
        name: mockRegularUser.name,
        email: mockRegularUser.email,
        role: mockRegularUser.role,
        rememberMe: false
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                         CALLBACKS: SIGNIN (GOOGLE)                         */
  /* -------------------------------------------------------------------------- */
  describe('Callbacks: signIn', () => {
    const signInCallback = authOptions.callbacks?.signIn;

    it('should allow non-Google sign in directly', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      const result = await signInCallback({
        user: { id: '1', name: 'User', email: 'user@example.com' } as any,
        account: { provider: 'credentials', type: 'credentials', providerAccountId: '1' } as any
      });

      expect(result).toBe(true);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject Google sign in if user email is missing', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      const result = await signInCallback({
        user: { id: 'google-1', name: 'No Email User' } as any,
        account: {
          provider: 'google',
          type: 'oauth',
          providerAccountId: 'google-acc-1'
        } as any
      });

      expect(result).toBe(false);
    });

    it('should auto-create a new user when signing in with Google for the first time', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        ...mockGoogleUser,
        id: 'created-google-user-id'
      });
      mockPrisma.account.upsert.mockResolvedValueOnce({});

      const result = await signInCallback({
        user: {
          id: 'google-sub-id',
          name: 'New Google User',
          email: 'newgoogle@example.com'
        } as any,
        account: {
          provider: 'google',
          type: 'oauth',
          providerAccountId: 'google-provider-acc-123',
          access_token: 'mock-access-token',
          id_token: 'mock-id-token',
          refresh_token: 'mock-refresh-token',
          expires_at: 1700000000,
          token_type: 'Bearer',
          scope: 'openid profile email'
        } as any
      });

      expect(result).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newgoogle@example.com',
          name: 'New Google User',
          phone: null,
          password: null,
          emailVerified: expect.any(Date),
          role: 'USER',
          isActive: true,
          stripeCustomerId: 'cus_mock_123'
        }
      });
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: 'google-provider-acc-123'
          }
        },
        update: expect.objectContaining({
          access_token: 'mock-access-token',
          id_token: 'mock-id-token'
        }),
        create: expect.objectContaining({
          userId: 'created-google-user-id',
          provider: 'google',
          providerAccountId: 'google-provider-acc-123'
        })
      });
    });

    it('should link Google OAuth account to an existing credentials user without duplicate creation and preserve existing password', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      // Existing user with password in DB
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.account.upsert.mockResolvedValueOnce({});

      const result = await signInCallback({
        user: {
          id: mockRegularUser.id,
          name: mockRegularUser.name,
          email: mockRegularUser.email.toUpperCase() // Test case-insensitivity
        } as any,
        account: {
          provider: 'google',
          type: 'oauth',
          providerAccountId: 'google-acc-credentials-link',
          access_token: 'google-link-access-token',
          id_token: 'google-link-id-token'
        } as any
      });

      expect(result).toBe(true);
      // Ensure duplicate user creation was NOT called
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      // Ensure account is linked to the existing user ID
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: 'google-acc-credentials-link'
          }
        },
        update: expect.objectContaining({
          access_token: 'google-link-access-token'
        }),
        create: expect.objectContaining({
          userId: mockRegularUser.id,
          provider: 'google',
          providerAccountId: 'google-acc-credentials-link'
        })
      });
    });

    it('should safely handle Google OAuth response when optional fields (refresh_token, expires_at, scope) are missing', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.account.upsert.mockResolvedValueOnce({});

      const result = await signInCallback({
        user: {
          id: mockRegularUser.id,
          name: mockRegularUser.name,
          email: mockRegularUser.email
        } as any,
        account: {
          provider: 'google',
          type: 'oauth',
          providerAccountId: 'google-acc-missing-optional',
          access_token: 'access-token-only'
          // refresh_token, id_token, expires_at, scope omitted
        } as any
      });

      expect(result).toBe(true);
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: mockRegularUser.id,
            providerAccountId: 'google-acc-missing-optional',
            access_token: 'access-token-only'
          })
        })
      );
    });

    it('should reject Google sign in if existing user account is inactive', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockInactiveUser);

      const result = await signInCallback({
        user: {
          id: mockInactiveUser.id,
          name: mockInactiveUser.name,
          email: mockInactiveUser.email
        } as any,
        account: {
          provider: 'google',
          type: 'oauth',
          providerAccountId: 'google-acc-inactive'
        } as any
      });

      expect(result).toBe(false);
      expect(mockPrisma.account.upsert).not.toHaveBeenCalled();
    });

    it('should throw when account upsert fails in signIn callback', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.account.upsert.mockRejectedValueOnce(new Error('OAuth linking failure'));

      await expect(
        signInCallback({
          user: { id: '1', email: 'user@example.com' } as any,
          account: { provider: 'google', type: 'oauth', providerAccountId: 'acc-1' } as any
        })
      ).rejects.toThrow('OAuth linking failure');
    });

    /* -------------------------------------------------------------------------- */
    /*                         FACEBOOK OAUTH SIGNIN                              */
    /* -------------------------------------------------------------------------- */
    it('should create new user and link Facebook account when Facebook provides email', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      mockPrisma.account.findUnique.mockResolvedValueOnce(null); // Account not found
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // User not found
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-fb-user-id',
        email: 'fbuser@example.com',
        name: 'FB User',
        role: 'USER',
        isActive: true
      });
      mockPrisma.account.upsert.mockResolvedValueOnce({});

      const result = await signInCallback({
        user: {
          id: 'temp-id',
          name: 'FB User',
          email: 'fbuser@example.com'
        } as any,
        account: {
          provider: 'facebook',
          type: 'oauth',
          providerAccountId: 'fb-provider-acc-123',
          access_token: 'mock-fb-token'
        } as any
      });

      expect(result).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'fbuser@example.com',
          name: 'FB User',
          role: 'USER',
          isActive: true
        })
      });
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: 'new-fb-user-id',
            provider: 'facebook',
            providerAccountId: 'fb-provider-acc-123'
          })
        })
      );
    });

    it('should link Facebook account to existing user (e.g. Google/Credentials) when email matches', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      mockPrisma.account.findUnique.mockResolvedValueOnce(null); // Account not found
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser); // Existing user
      mockPrisma.account.upsert.mockResolvedValueOnce({});

      const result = await signInCallback({
        user: {
          id: 'temp-id',
          name: 'FB User',
          email: mockRegularUser.email
        } as any,
        account: {
          provider: 'facebook',
          type: 'oauth',
          providerAccountId: 'fb-provider-acc-456',
          access_token: 'mock-fb-token'
        } as any
      });

      expect(result).toBe(true);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: mockRegularUser.id,
            provider: 'facebook',
            providerAccountId: 'fb-provider-acc-456'
          })
        })
      );
    });

    it('should allow subsequent Facebook login when email is missing and account already exists', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      // Account already linked
      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-linked-1',
        userId: mockRegularUser.id,
        provider: 'facebook',
        providerAccountId: 'fb-existing-acc-id'
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.account.update.mockResolvedValueOnce({});

      const result = await signInCallback({
        user: {
          id: 'temp-fb-id',
          name: 'FB No Email User'
          // no email
        } as any,
        account: {
          provider: 'facebook',
          type: 'oauth',
          providerAccountId: 'fb-existing-acc-id'
        } as any
      });

      expect(result).toBe(true);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.account.update).toHaveBeenCalled();
    });

    it('should create pending token and return redirect URL when email is missing on first-time Facebook login', async () => {
      if (!signInCallback) throw new Error('signIn callback is undefined');

      // Account does not exist
      mockPrisma.account.findUnique.mockResolvedValueOnce(null);
      mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.verificationToken.create.mockResolvedValueOnce({
        id: 'vt-1',
        identifier: 'fb_pending:fb-new-acc-id:FB%20User',
        token: 'pending-token-123'
      });

      const result = await signInCallback({
        user: {
          id: 'temp-fb-id',
          name: 'FB User'
          // no email
        } as any,
        account: {
          provider: 'facebook',
          type: 'oauth',
          providerAccountId: 'fb-new-acc-id'
        } as any
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('/facebook-email?pendingToken=');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              CALLBACKS: JWT                                */
  /* -------------------------------------------------------------------------- */
  describe('Callbacks: jwt', () => {
    const jwtCallback = authOptions.callbacks?.jwt;

    it('should set token properties for credentials login with rememberMe: true (5 days expiry)', async () => {
      if (!jwtCallback) throw new Error('jwt callback is undefined');

      const now = Date.now();
      const initialToken = {};
      const user = {
        id: mockRegularUser.id,
        role: mockRegularUser.role,
        email: mockRegularUser.email,
        rememberMe: true
      };

      const result = await jwtCallback({
        token: initialToken,
        user: user as any,
        account: { provider: 'credentials', type: 'credentials', providerAccountId: '1' } as any
      });

      expect(result.rememberMe).toBe(true);
      expect(result.id).toBe(mockRegularUser.id);
      expect(result.role).toBe(mockRegularUser.role);
      expect(result.email).toBe(mockRegularUser.email);
      expect((result.sessionExpiresAt as number)).toBeGreaterThanOrEqual(
        now + SESSION_DURATION_REMEMBER_ME_MS - 500
      );
    });

    it('should set token properties for credentials login with rememberMe: false (1 day expiry)', async () => {
      if (!jwtCallback) throw new Error('jwt callback is undefined');

      const now = Date.now();
      const initialToken = {};
      const user = {
        id: mockRegularUser.id,
        role: mockRegularUser.role,
        email: mockRegularUser.email,
        rememberMe: false
      };

      const result = await jwtCallback({
        token: initialToken,
        user: user as any,
        account: { provider: 'credentials', type: 'credentials', providerAccountId: '1' } as any
      });

      expect(result.rememberMe).toBe(false);
      expect((result.sessionExpiresAt as number)).toBeLessThan(
        now + SESSION_DURATION_REMEMBER_ME_MS
      );
      expect((result.sessionExpiresAt as number)).toBeGreaterThanOrEqual(
        now + SESSION_DURATION_DEFAULT_MS - 500
      );
    });

    it('should query DB and set token properties for Google login', async () => {
      if (!jwtCallback) throw new Error('jwt callback is undefined');

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockGoogleUser);

      const initialToken = {};
      const user = {
        id: 'oauth-id',
        name: 'Google User',
        email: 'googleuser@example.com'
      };

      const result = await jwtCallback({
        token: initialToken,
        user: user as any,
        account: { provider: 'google', type: 'oauth', providerAccountId: 'g-123' } as any
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'googleuser@example.com' }
      });
      expect(result.id).toBe(mockGoogleUser.id);
      expect(result.role).toBe(mockGoogleUser.role);
      expect(result.email).toBe(mockGoogleUser.email);
      expect(result.rememberMe).toBe(false);
    });

    it('should query DB and set token properties for Facebook login with email', async () => {
      if (!jwtCallback) throw new Error('jwt callback is undefined');

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);

      const initialToken = {};
      const user = {
        id: 'fb-temp-id',
        name: 'FB User',
        email: 'john@example.com'
      };

      const result = await jwtCallback({
        token: initialToken,
        user: user as any,
        account: { provider: 'facebook', type: 'oauth', providerAccountId: 'fb-123' } as any
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' }
      });
      expect(result.id).toBe(mockRegularUser.id);
      expect(result.role).toBe(mockRegularUser.role);
      expect(result.email).toBe(mockRegularUser.email);
    });

    it('should query DB by providerAccountId and set token properties for Facebook login without email', async () => {
      if (!jwtCallback) throw new Error('jwt callback is undefined');

      mockPrisma.account.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        userId: mockRegularUser.id,
        user: mockRegularUser
      });

      const initialToken = {};
      const user = {
        id: 'fb-temp-id',
        name: 'FB No Email User'
      };

      const result = await jwtCallback({
        token: initialToken,
        user: user as any,
        account: { provider: 'facebook', type: 'oauth', providerAccountId: 'fb-no-email-123' } as any
      });

      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'facebook',
            providerAccountId: 'fb-no-email-123'
          }
        },
        include: { user: true }
      });
      expect(result.id).toBe(mockRegularUser.id);
      expect(result.role).toBe(mockRegularUser.role);
      expect(result.email).toBe(mockRegularUser.email);
    });

    it('should preserve existing token on subsequent calls when user is undefined (stateless JWT)', async () => {
      if (!jwtCallback) throw new Error('jwt callback is undefined');

      const existingToken = {
        id: mockRegularUser.id,
        role: mockRegularUser.role,
        email: mockRegularUser.email,
        rememberMe: true,
        sessionExpiresAt: 1999999999
      };

      const result = await jwtCallback({
        token: existingToken
      } as any);

      expect(result).toEqual(existingToken);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            CALLBACKS: SESSION                              */
  /* -------------------------------------------------------------------------- */
  describe('Callbacks: session', () => {
    const sessionCallback = authOptions.callbacks?.session;

    it('should attach id, role, rememberMe, and sessionExpiresAt from token onto session.user', async () => {
      if (!sessionCallback) throw new Error('session callback is undefined');

      const initialSession = {
        user: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        expires: new Date(Date.now() + 86400000).toISOString()
      };

      const token = {
        id: mockAuthTokenUser.id,
        role: mockAuthTokenUser.role,
        rememberMe: true,
        sessionExpiresAt: mockAuthTokenUser.sessionExpiresAt
      };

      const result = (await (sessionCallback as any)({
        session: initialSession,
        token
      })) as any;

      expect(result.user.id).toBe(mockAuthTokenUser.id);
      expect(result.user.role).toBe(mockAuthTokenUser.role);
      expect(result.user.rememberMe).toBe(true);
      expect(result.user.sessionExpiresAt).toBe(mockAuthTokenUser.sessionExpiresAt);
    });
  });
});

/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/no-require-imports */

