import { randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/stripe-server';
import { logStripeError } from '@/lib/stripe/errors';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import {
  validateSendFacebookOtpInput,
  validateVerifyFacebookOtpInput
} from '@/server/middlewares';

/**
 * Creates a temporary pending verification token in VerificationToken table
 * when Facebook OAuth completes without an email address.
 */
export async function createFacebookPendingTokenServer(
  providerAccountId: string,
  name?: string | null
): Promise<string> {
  const pendingToken = randomBytes(32).toString('hex');
  const encodedName = encodeURIComponent(name || 'Facebook User');
  const identifier = `fb_pending:${providerAccountId}:${encodedName}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Clean up any stale pending tokens for this providerAccountId
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: {
        startsWith: `fb_pending:${providerAccountId}:`
      }
    }
  });

  await prisma.verificationToken.create({
    data: {
      identifier,
      token: pendingToken,
      expiresAt
    }
  });

  return pendingToken;
}

/**
 * Validates the pending Facebook session, generates a 6-digit OTP, and sends it to the supplied email.
 */
export async function sendFacebookEmailOtpServer(body: unknown) {
  const validation = validateSendFacebookOtpInput(body);
  if (!validation.success) {
    return validation;
  }

  const { pendingToken, email } = validation.data;
  const normalizedEmail = email.toLowerCase().trim();

  const pendingRecord = await prisma.verificationToken.findUnique({
    where: { token: pendingToken }
  });

  if (
    !pendingRecord ||
    pendingRecord.expiresAt < new Date() ||
    !pendingRecord.identifier.startsWith('fb_pending:')
  ) {
    return {
      success: false as const,
      status: 400,
      errors: ['SESSION_EXPIRED'],
      message: 'Facebook session has expired. Please sign in with Facebook again.'
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser && !existingUser.isActive) {
    return {
      success: false as const,
      status: 400,
      errors: ['ACCOUNT_INACTIVE'],
      message: 'This user account is inactive. Please contact support.'
    };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpIdentifier = `fb_otp:${pendingToken}:${normalizedEmail}`;
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any existing OTP for this session and email
  await prisma.verificationToken.deleteMany({
    where: { identifier: otpIdentifier }
  });

  await prisma.verificationToken.create({
    data: {
      identifier: otpIdentifier,
      token: otp,
      expiresAt: otpExpiresAt
    }
  });

  try {
    const schedulerRes = await schedulerClient.enqueueFacebookOtpEmail({
      email: normalizedEmail,
      otp
    });

    if (!schedulerRes.success) {
      console.error('Scheduler failed to enqueue Facebook OTP email:', schedulerRes.error);
      return {
        success: false as const,
        status: 500,
        errors: [],
        message: 'Failed to send verification email. Please try again later.'
      };
    }
  } catch (emailErr) {
    console.error('Failed to send Facebook OTP email:', emailErr);
    return {
      success: false as const,
      status: 500,
      errors: [],
      message: 'Failed to send verification email. Please try again later.'
    };
  }

  return {
    success: true as const, status: 200, message: 'Verification code sent to your email.'
  };
}

/**
 * Validates the 6-digit OTP, safely finds or creates the User, and links the Facebook Account.
 */
export async function verifyFacebookEmailOtpServer(body: unknown) {
  const validation = validateVerifyFacebookOtpInput(body);
  if (!validation.success) {
    return validation;
  }

  const { pendingToken, email, otp } = validation.data;
  const normalizedEmail = email.toLowerCase().trim();

  const pendingRecord = await prisma.verificationToken.findUnique({
    where: { token: pendingToken }
  });

  if (
    !pendingRecord ||
    pendingRecord.expiresAt < new Date() ||
    !pendingRecord.identifier.startsWith('fb_pending:')
  ) {
    return {
      success: false as const,
      status: 400,
      errors: ['SESSION_EXPIRED'],
      message: 'Facebook session has expired. Please sign in with Facebook again.'
    };
  }

  // Parse identifier: fb_pending:${providerAccountId}:${encodedName}
  const parts = pendingRecord.identifier.split(':');
  const providerAccountId = parts[1];
  const rawName = parts[2] ? decodeURIComponent(parts[2]) : 'Facebook User';

  if (!providerAccountId) {
    return {
      success: false as const,
      status: 400,
      errors: ['INVALID_SESSION'],
      message: 'Invalid Facebook session data. Please try again.'
    };
  }

  const otpIdentifier = `fb_otp:${pendingToken}:${normalizedEmail}`;
  const otpRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: otpIdentifier,
      token: otp
    }
  });

  if (!otpRecord || otpRecord.expiresAt < new Date()) {
    return {
      success: false as const,
      status: 400,
      errors: ['INVALID_OTP'],
      message: 'Invalid or expired verification code'
    };
  }

  // Perform User finding/creation and Facebook Account linking
  let targetUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (targetUser && !targetUser.isActive) {
    return {
      success: false as const,
      status: 400,
      errors: ['ACCOUNT_INACTIVE'],
      message: 'This user account is inactive.'
    };
  }

  if (!targetUser) {
    let stripeCustomerId: string | null = null;
    try {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        name: rawName || 'Facebook User'
      });
      stripeCustomerId = customer.id;
    } catch (stripeErr) {
      logStripeError('verifyFacebookEmailOtpServer:stripe.customers.create', stripeErr, {
        email: normalizedEmail
      });
    }

    targetUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: rawName || 'Facebook User',
        emailVerified: new Date(),
        role: 'USER',
        isActive: true,
        stripeCustomerId
      }
    });
  } else if (!targetUser.emailVerified) {
    targetUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: { emailVerified: new Date() }
    });
  }

  // Link Facebook Account to User
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'facebook',
        providerAccountId
      }
    },
    update: {
      userId: targetUser.id
    },
    create: {
      userId: targetUser.id,
      type: 'oauth',
      provider: 'facebook',
      providerAccountId
    }
  });

  // Clean up used VerificationTokens
  await prisma.verificationToken.deleteMany({
    where: {
      OR: [
        { token: pendingToken },
        { identifier: otpIdentifier }
      ]
    }
  });

  return {
    success: true as const,
    status: 200,
    message: 'Email verified and Facebook account linked successfully',
    user: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role
    }
  };
}
