/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { hash, compare } from 'bcryptjs';

import { schedulerClient } from '@/services/scheduler/scheduler.client';
import {
  signupUserServer,
  forgotPasswordServer,
  validateResetTokenServer,
  resetPasswordServer,
  changePasswordServer,
  verifyEmailServer
} from '@/server/services/auth.service';

import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import {
  mockRegularUser,
  mockUserWithValidResetToken,
  mockUserWithExpiredResetToken,
  mockValidVerificationToken,
  mockExpiredVerificationToken,
  mockSignupPayload,
  mockForgotPasswordPayload,
  mockResetPasswordPayload,
  mockChangePasswordPayload
} from '../mocks/auth.mock';

jest.mock('@/lib/prisma', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma
}));

// Mock external dependencies
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$newHashedPasswordMock1234567890'),
  compare: jest.fn().mockImplementation(async (plain: string, hashed: string) => {
    return plain === 'OldPassword123!' || plain === 'NewPassword123!' || hashed.includes('hashedPasswordExample');
  })
}));

jest.mock('@/services/scheduler/scheduler.client', () => ({
  schedulerClient: {
    enqueueForgotPasswordEmail: jest.fn().mockResolvedValue({ success: true, taskId: 'mock-task-id' })
  }
}));

describe('Server Auth Service (auth.service.ts)', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('signupUserServer', () => {
    it('should return validation error if payload is invalid', async () => {
      const invalidPayload = {
        fullName: 'J', // too short
        email: 'not-an-email',
        password: 'short',
        confirmPassword: 'mismatch'
      };

      const result = await signupUserServer(invalidPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('Enter your full name');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should return 409 Conflict if email already exists in DB', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);

      const result = await signupUserServer(mockSignupPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.message).toBe('A user with this email already exists');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockSignupPayload.email.toLowerCase().trim() }
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should normalize email casing on lookup and storage (Test@Email.com -> test@email.com)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        name: 'Test User',
        email: 'test@email.com',
        phone: null,
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00Z')
      });

      const payloadWithMixedCase = {
        ...mockSignupPayload,
        email: 'Test@Email.com'
      };

      const result = await signupUserServer(payloadWithMixedCase);

      expect(result.success).toBe(true);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@email.com' }
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@email.com'
          })
        })
      );
    });

    it('should reject signup when uppercase version of an existing email is submitted (TEST@EMAIL.COM)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);

      const payloadUpperCase = {
        ...mockSignupPayload,
        email: 'TEST@EMAIL.COM'
      };

      const result = await signupUserServer(payloadUpperCase);

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@email.com' }
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle database unique constraint violation (P2002) during concurrent creation', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const prismaUniqueError = new Error('Unique constraint failed on the fields: (`email`)');
      (prismaUniqueError as any).code = 'P2002';
      mockPrisma.user.create.mockRejectedValueOnce(prismaUniqueError);

      await expect(signupUserServer(mockSignupPayload)).rejects.toThrow('Unique constraint failed');
    });

    it('should throw when database query fails unexpectedly', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('Database connection timeout'));

      await expect(signupUserServer(mockSignupPayload)).rejects.toThrow('Database connection timeout');
    });

    it('should successfully create a new user with hashed password and return 201', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        name: mockSignupPayload.fullName,
        email: mockSignupPayload.email.toLowerCase().trim(),
        phone: mockSignupPayload.mobile,
        role: 'USER',
        createdAt: new Date('2026-01-01T00:00:00Z')
      });

      const result = await signupUserServer(mockSignupPayload);

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(result.message).toBe('Account created successfully');
      expect(hash).toHaveBeenCalledWith(mockSignupPayload.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: mockSignupPayload.fullName,
          email: mockSignupPayload.email.toLowerCase().trim(),
          phone: mockSignupPayload.mobile,
          password: '$2a$12$newHashedPasswordMock1234567890',
          stripeCustomerId: 'cus_mock_123'
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          stripeCustomerId: true,
          createdAt: true
        }
      });
      if (result.success) {
        expect(result.user).toBeDefined();
        expect(result.user.email).toBe(mockSignupPayload.email);
      }
    });

    it('should handle optional phone number being empty or undefined', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id-2',
        name: 'Alice Doe',
        email: 'alice@example.com',
        phone: null,
        role: 'USER',
        createdAt: new Date()
      });

      const payloadWithoutPhone = {
        fullName: 'Alice Doe',
        email: 'alice@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      };

      const result = await signupUserServer(payloadWithoutPhone);

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: null
          })
        })
      );
    });
  });

  describe('forgotPasswordServer', () => {
    it('should return validation error if email format is invalid', async () => {
      const result = await forgotPasswordServer({ email: 'invalid-email-string' });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return 404 if user email does not exist in DB', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await forgotPasswordServer(mockForgotPasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('This email does not exist in our Store.');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(schedulerClient.enqueueForgotPasswordEmail).not.toHaveBeenCalled();
    });

    it('should generate reset token, update user, send email, and return 200', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockRegularUser,
        resetToken: 'generated-token-hex'
      });

      const result = await forgotPasswordServer(mockForgotPasswordPayload);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toBe('Password reset instructions have been sent to your email.');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockRegularUser.id },
        data: {
          resetToken: expect.any(String),
          resetTokenExpires: expect.any(Date)
        }
      });
      expect(schedulerClient.enqueueForgotPasswordEmail).toHaveBeenCalledWith({
        userId: mockRegularUser.id,
        email: mockRegularUser.email,
        resetToken: expect.any(String)
      });
    });

    it('should overwrite previous reset token when user requests password reset again', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser);
      mockPrisma.user.update.mockResolvedValue(mockRegularUser);

      // First reset request
      const firstResult = await forgotPasswordServer(mockForgotPasswordPayload);
      expect(firstResult.success).toBe(true);

      // Second reset request
      const secondResult = await forgotPasswordServer(mockForgotPasswordPayload);
      expect(secondResult.success).toBe(true);

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
    });

    it('should throw when database update fails during token generation', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.user.update.mockRejectedValueOnce(new Error('DB Deadlock'));

      await expect(forgotPasswordServer(mockForgotPasswordPayload)).rejects.toThrow('DB Deadlock');
    });

    it('should return 500 status if email job enqueuing fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.user.update.mockResolvedValueOnce(mockRegularUser);
      (schedulerClient.enqueueForgotPasswordEmail as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Scheduler Service Unavailable'
      });

      const result = await forgotPasswordServer(mockForgotPasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(result.message).toBe('Failed to send password reset email. Please try again later.');
    });
  });

  describe('validateResetTokenServer', () => {
    it('should return 400 if token string is empty or invalid', async () => {
      const result = await validateResetTokenServer('   ');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Missing reset token');
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('should return 400 if token is not found in database', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const result = await validateResetTokenServer('non-existent-token');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('This password reset link is invalid.');
    });

    it('should return 400 if reset token has expired (expiresAt < now)', () => {
      jest.useFakeTimers();
      const fixedNow = new Date('2026-08-29T12:00:00.000Z');
      jest.setSystemTime(fixedNow);

      const userWithPastExpiry = {
        ...mockRegularUser,
        resetToken: 'token-past-expiry',
        resetTokenExpires: new Date(fixedNow.getTime() - 1000) // 1 second ago
      };
      mockPrisma.user.findFirst.mockResolvedValueOnce(userWithPastExpiry);

      return validateResetTokenServer('token-past-expiry').then((result) => {
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
        expect(result.message).toBe('This password reset link has expired.');
      });
    });

    it('should consider token valid when expiresAt is exactly equal to current timestamp', () => {
      jest.useFakeTimers();
      const fixedNow = new Date('2026-08-29T12:00:00.000Z');
      jest.setSystemTime(fixedNow);

      const userWithExactExpiry = {
        ...mockRegularUser,
        resetToken: 'token-exact-expiry',
        resetTokenExpires: new Date(fixedNow.getTime()) // exactly now
      };
      mockPrisma.user.findFirst.mockResolvedValueOnce(userWithExactExpiry);

      return validateResetTokenServer('token-exact-expiry').then((result) => {
        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
      });
    });

    it('should consider token valid when expiresAt is in the future (expiresAt > now)', () => {
      jest.useFakeTimers();
      const fixedNow = new Date('2026-08-29T12:00:00.000Z');
      jest.setSystemTime(fixedNow);

      const userWithFutureExpiry = {
        ...mockRegularUser,
        resetToken: 'token-future-expiry',
        resetTokenExpires: new Date(fixedNow.getTime() + 1000 * 60 * 30) // 30 mins in future
      };
      mockPrisma.user.findFirst.mockResolvedValueOnce(userWithFutureExpiry);

      return validateResetTokenServer('token-future-expiry').then((result) => {
        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
      });
    });

    it('should return 400 if user is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        ...mockUserWithValidResetToken,
        isActive: false
      });

      const result = await validateResetTokenServer('valid-reset-token-hex-string-32-chars');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('User account is inactive.');
    });

    it('should throw when database query throws unexpected error', async () => {
      mockPrisma.user.findFirst.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(validateResetTokenServer('any-token')).rejects.toThrow('Database connection lost');
    });
  });

  describe('resetPasswordServer', () => {
    it('should return validation error if passwords do not match or are too weak', async () => {
      const invalidPayload = {
        token: 'some-token',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!'
      };

      const result = await resetPasswordServer(invalidPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('should return 400 if reset token does not match any user', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const result = await resetPasswordServer(mockResetPasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('The reset link is invalid or has expired');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should prevent password reset token reuse (first use succeeds, second use fails)', async () => {
      // First usage: token is valid in DB
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUserWithValidResetToken);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockUserWithValidResetToken,
        resetToken: null,
        resetTokenExpires: null
      });

      const firstReset = await resetPasswordServer(mockResetPasswordPayload);
      expect(firstReset.success).toBe(true);
      expect(firstReset.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserWithValidResetToken.id },
        data: {
          password: expect.any(String),
          resetToken: null,
          resetTokenExpires: null
        }
      });

      // Second usage: token is no longer in DB (cleared)
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const secondReset = await resetPasswordServer(mockResetPasswordPayload);
      expect(secondReset.success).toBe(false);
      expect(secondReset.status).toBe(400);
      expect(secondReset.message).toBe('The reset link is invalid or has expired');
    });

    it('should invalidate old Token A when Token B was generated after multiple requests', async () => {
      // User requested reset twice, DB currently holds Token B
      const tokenA = 'old-token-a-12345';
      const tokenB = 'new-token-b-67890';

      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.resetToken === tokenB) {
          return {
            ...mockRegularUser,
            resetToken: tokenB,
            resetTokenExpires: new Date(Date.now() + 100000)
          };
        }
        return null; // Token A is not found
      });

      // Attempting with Token A fails
      const resetWithA = await resetPasswordServer({
        token: tokenA,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      });
      expect(resetWithA.success).toBe(false);
      expect(resetWithA.status).toBe(400);

      // Attempting with Token B succeeds
      mockPrisma.user.update.mockResolvedValueOnce(mockRegularUser);
      const resetWithB = await resetPasswordServer({
        token: tokenB,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      });
      expect(resetWithB.success).toBe(true);
      expect(resetWithB.status).toBe(200);
    });

    it('should return 400 if token has expired or user is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUserWithExpiredResetToken);

      const result = await resetPasswordServer(mockResetPasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('The reset link is invalid or has expired');
    });

    it('should throw when database update fails during password reset', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUserWithValidResetToken);
      mockPrisma.user.update.mockRejectedValueOnce(new Error('Database transaction failed'));

      await expect(resetPasswordServer(mockResetPasswordPayload)).rejects.toThrow('Database transaction failed');
    });
  });

  describe('changePasswordServer', () => {
    it('should return validation error if passwords do not match', async () => {
      const invalidPayload = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'WrongMismatch123!'
      };

      const result = await changePasswordServer(mockRegularUser.id, invalidPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should allow changing password when new password matches current password (application behavior)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.user.update.mockResolvedValueOnce(mockRegularUser);

      const samePasswordPayload = {
        currentPassword: 'OldPassword123!',
        newPassword: 'OldPassword123!',
        confirmPassword: 'OldPassword123!'
      };

      const result = await changePasswordServer(mockRegularUser.id, samePasswordPayload);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should return 404 if user is not found or is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await changePasswordServer('non-existent-user', mockChangePasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('User not found or inactive');
    });

    it('should return 400 if user account has no password set (e.g. OAuth/Google user)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockRegularUser,
        password: null
      });

      const result = await changePasswordServer(mockRegularUser.id, mockChangePasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('No password set for this account. Please use password reset.');
    });

    it('should return 400 if current password comparison fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await changePasswordServer(mockRegularUser.id, mockChangePasswordPayload);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Incorrect current password');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should update password in DB and return 200 when current password matches', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockRegularUser);
      (compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockRegularUser,
        password: '$2a$12$newHashedPasswordMock1234567890'
      });

      const result = await changePasswordServer(mockRegularUser.id, mockChangePasswordPayload);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toBe('Password updated successfully');
      expect(hash).toHaveBeenCalledWith(mockChangePasswordPayload.newPassword, 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockRegularUser.id },
        data: { password: '$2a$12$newHashedPasswordMock1234567890' }
      });
    });

    it('should throw when database query fails unexpectedly in changePasswordServer', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('Database connection refused'));

      await expect(changePasswordServer(mockRegularUser.id, mockChangePasswordPayload)).rejects.toThrow('Database connection refused');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          VERIFY EMAIL SERVER                               */
  /* -------------------------------------------------------------------------- */
  describe('verifyEmailServer', () => {
    it('should return 400 if verification token is empty or invalid', async () => {
      const result = await verifyEmailServer('');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Verification token is required');
      expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
    });

    it('should return 400 if verification token does not exist in DB', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

      const result = await verifyEmailServer('invalid-token');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Invalid or expired verification token');
    });

    it('should return 400 if verification token is expired', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(mockExpiredVerificationToken);

      const result = await verifyEmailServer('expired-verification-token-string');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Invalid or expired verification token');
    });

    it('should update user emailVerified, delete verification token, and return 200 on valid token', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(mockValidVerificationToken);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockRegularUser,
        emailVerified: new Date()
      });
      mockPrisma.verificationToken.delete.mockResolvedValueOnce(mockValidVerificationToken);

      const result = await verifyEmailServer('valid-verification-token-string');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toBe('Email verified successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { email: mockValidVerificationToken.identifier },
        data: { emailVerified: expect.any(Date) }
      });
      expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
        where: { token: 'valid-verification-token-string' }
      });
    });

    it('should throw when database token deletion fails', async () => {
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(mockValidVerificationToken);
      mockPrisma.user.update.mockResolvedValueOnce(mockRegularUser);
      mockPrisma.verificationToken.delete.mockRejectedValueOnce(new Error('DB delete failed'));

      await expect(verifyEmailServer('valid-verification-token-string')).rejects.toThrow('DB delete failed');
    });
  });
});

/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/no-require-imports */

