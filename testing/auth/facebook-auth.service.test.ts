/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/lib/prisma', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma
}));

jest.mock('@/lib/stripe/stripe-server', () => ({
  stripe: {
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_facebook_test_123' })
    }
  }
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-msg-id' }),
  sendFacebookVerificationOtpEmail: jest.fn().mockResolvedValue(undefined)
}));

import {
  createFacebookPendingTokenServer,
  sendFacebookEmailOtpServer,
  verifyFacebookEmailOtpServer
} from '@/server/services/facebook-auth.service';
import { sendFacebookVerificationOtpEmail } from '@/lib/email';
import { stripe } from '@/lib/stripe/stripe-server';

import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import { mockRegularUser, mockInactiveUser } from '../mocks/auth.mock';

describe('Facebook Auth Service (server/services/facebook-auth.service.ts)', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
  });

  const MOCK_FB_PROVIDER_ACCOUNT_ID = 'fb-account-id-987654321';
  const MOCK_PENDING_TOKEN = 'test-pending-token-hex-32-chars-long';

  /* -------------------------------------------------------------------------- */
  /* 1. createFacebookPendingTokenServer                                        */
  /* -------------------------------------------------------------------------- */
  describe('createFacebookPendingTokenServer', () => {
    it('creates a temporary pending verification token with 15 min expiry', async () => {
      mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.verificationToken.create.mockResolvedValueOnce({
        id: 'vt-1',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:Facebook%20User`,
        token: 'generated-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date()
      });

      const token = await createFacebookPendingTokenServer(MOCK_FB_PROVIDER_ACCOUNT_ID, 'Facebook User');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { identifier: { startsWith: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:` } }
      });
      expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: expect.stringContaining(MOCK_FB_PROVIDER_ACCOUNT_ID),
          token: expect.any(String),
          expiresAt: expect.any(Date)
        })
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. sendFacebookEmailOtpServer                                              */
  /* -------------------------------------------------------------------------- */
  describe('sendFacebookEmailOtpServer', () => {
    it('rejects invalid email or missing pendingToken', async () => {
      const result1 = await sendFacebookEmailOtpServer({ pendingToken: '', email: 'valid@example.com' });
      expect(result1.success).toBe(false);
      expect(result1.status).toBe(400);

      const result2 = await sendFacebookEmailOtpServer({ pendingToken: MOCK_PENDING_TOKEN, email: 'not-an-email' });
      expect(result2.success).toBe(false);
      expect(result2.status).toBe(400);
    });

    it('rejects when pending session token is not found in database', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

      const result = await sendFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'user@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('Facebook session has expired');
    });

    it('rejects when pending session token is expired', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-expired',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:John`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() - 1000 * 60) // 1 min ago
      });

      const result = await sendFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'user@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('Facebook session has expired');
    });

    it('rejects if the target user account is inactive', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-valid',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:John`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockInactiveUser);

      const result = await sendFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: mockInactiveUser.email
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('inactive');
    });

    it('generates 6-digit OTP, stores it with 10 min expiry, and sends email', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-valid',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:John`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // New user
      mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.verificationToken.create.mockResolvedValueOnce({ id: 'otp-record-1' });

      const result = await sendFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'NEWUSER@EXAMPLE.COM' // test normalization
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toContain('Verification code sent');
      expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: `fb_otp:${MOCK_PENDING_TOKEN}:newuser@example.com`,
          token: expect.stringMatching(/^\d{6}$/),
          expiresAt: expect.any(Date)
        })
      });
      expect(sendFacebookVerificationOtpEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.stringMatching(/^\d{6}$/)
      );
    });

    it('handles email delivery failure gracefully', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-valid',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:John`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.verificationToken.create.mockResolvedValueOnce({ id: 'otp-record-1' });
      (sendFacebookVerificationOtpEmail as jest.Mock).mockRejectedValueOnce(new Error('SMTP down'));

      const result = await sendFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'user@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(result.message).toContain('Failed to send verification email');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. verifyFacebookEmailOtpServer                                            */
  /* -------------------------------------------------------------------------- */
  describe('verifyFacebookEmailOtpServer', () => {
    it('rejects invalid OTP payload (non-6 digit OTP or missing fields)', async () => {
      const result1 = await verifyFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'user@example.com',
        otp: '123' // too short
      });
      expect(result1.success).toBe(false);
      expect(result1.status).toBe(400);

      const result2 = await verifyFacebookEmailOtpServer({
        pendingToken: '',
        email: 'user@example.com',
        otp: '123456'
      });
      expect(result2.success).toBe(false);
      expect(result2.status).toBe(400);
    });

    it('rejects when pending session is expired or not found', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

      const result = await verifyFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'user@example.com',
        otp: '123456'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('Facebook session has expired');
    });

    it('rejects when OTP is invalid or expired', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-valid',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:John%20Doe`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      });
      // OTP not found in DB
      mockPrisma.verificationToken.findFirst.mockResolvedValueOnce(null);

      const result = await verifyFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'user@example.com',
        otp: '999999'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('Invalid or expired verification code');
    });

    it('verifies OTP, creates a new User with Stripe customer, links Facebook Account, and cleans tokens', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-valid',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:Jane%20Smith`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      });
      mockPrisma.verificationToken.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        identifier: `fb_otp:${MOCK_PENDING_TOKEN}:jane@example.com`,
        token: '123456',
        expiresAt: new Date(Date.now() + 1000 * 60 * 5)
      });
      // User does not exist
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const createdUser = {
        id: 'user-new-cuid',
        email: 'jane@example.com',
        name: 'Jane Smith',
        role: 'USER',
        isActive: true,
        stripeCustomerId: 'cus_facebook_test_123'
      };
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);
      mockPrisma.account.upsert.mockResolvedValueOnce({ id: 'acc-fb-1' });
      mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await verifyFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'jane@example.com',
        otp: '123456'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      if (result.success) {
        expect(result.user?.email).toBe('jane@example.com');
      }
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: 'jane@example.com',
        name: 'Jane Smith'
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'jane@example.com',
          name: 'Jane Smith',
          role: 'USER',
          isActive: true,
          stripeCustomerId: 'cus_facebook_test_123'
        })
      });
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'facebook',
            providerAccountId: MOCK_FB_PROVIDER_ACCOUNT_ID
          }
        },
        update: { userId: createdUser.id },
        create: {
          userId: createdUser.id,
          type: 'oauth',
          provider: 'facebook',
          providerAccountId: MOCK_FB_PROVIDER_ACCOUNT_ID
        }
      });
      expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalled();
    });

    it('verifies OTP and links Facebook Account to an EXISTING User (e.g. Google user) safely', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        id: 'vt-valid',
        identifier: `fb_pending:${MOCK_FB_PROVIDER_ACCOUNT_ID}:John%20Doe`,
        token: MOCK_PENDING_TOKEN,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      });
      mockPrisma.verificationToken.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        identifier: `fb_otp:${MOCK_PENDING_TOKEN}:john@example.com`,
        token: '654321',
        expiresAt: new Date(Date.now() + 1000 * 60 * 5)
      });
      // User exists (e.g. from Google or credentials)
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.account.upsert.mockResolvedValueOnce({ id: 'acc-fb-linked' });
      mockPrisma.verificationToken.deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await verifyFacebookEmailOtpServer({
        pendingToken: MOCK_PENDING_TOKEN,
        email: 'john@example.com',
        otp: '654321'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      if (result.success) {
        expect(result.user?.id).toBe(mockRegularUser.id);
      }
      expect(mockPrisma.user.create).not.toHaveBeenCalled(); // DOES NOT create duplicate user!
      expect(mockPrisma.account.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: 'facebook',
            providerAccountId: MOCK_FB_PROVIDER_ACCOUNT_ID
          }
        },
        update: { userId: mockRegularUser.id },
        create: {
          userId: mockRegularUser.id,
          type: 'oauth',
          provider: 'facebook',
          providerAccountId: MOCK_FB_PROVIDER_ACCOUNT_ID
        }
      });
    });
  });
});
