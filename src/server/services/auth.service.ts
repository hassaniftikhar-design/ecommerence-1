import { randomBytes } from 'crypto';

import { hash, compare } from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import {
  validateSignupInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateChangePasswordInput,
  validateResetTokenInput,
  validateVerificationTokenInput
} from '@/server/middlewares';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import { PASSWORD_RESET_EXPIRATION_MINUTES } from '@/constants';
import { stripe } from '@/lib/stripe/stripe-server';
import { logStripeError } from '@/lib/stripe/errors';

export async function signupUserServer(body: unknown) {
  const validation = validateSignupInput(body);
  if (!validation.success) {
    return validation;
  }

  const { fullName, email, mobile, password } = validation.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    return { success: false as const, status: 409, errors: [], message: 'A user with this email already exists' };
  }

  const hashedPassword = await hash(password, 12);
  //Stripe customer id creating here, adn remain null on failure and cab be backfilled later on checkout
  let stripeCustomerId: string | null = null;
  try {
    const customer = await stripe.customers.create({
      email: normalizedEmail,
      name: fullName,
      phone: mobile || undefined
    });
    stripeCustomerId = customer.id;
  } catch (stripeErr) {
    logStripeError('signupUserServer:stripe.customers.create', stripeErr, {
      email: normalizedEmail
    });
  }

  const user = await prisma.user.create({
    data: {
      name: fullName,
      email: normalizedEmail,
      phone: mobile || null,
      password: hashedPassword,
      stripeCustomerId
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

  return { success: true as const, status: 201, user, message: 'Account created successfully' };
}

export async function forgotPasswordServer(body: unknown) {
  const validation = validateForgotPasswordInput(body);
  if (!validation.success) {
    return validation;
  }

  const { email } = validation.data;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return { success: false as const, status: 404, errors: [], message: 'This email does not exist in our Store.' };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpires: expiresAt
    }
  });

  try {
    // Offload to background Celery scheduler service
    const schedulerRes = await schedulerClient.enqueueForgotPasswordEmail({
      userId: user.id,
      email: user.email,
      resetToken: token
    });

    if (!schedulerRes.success) {
      console.error('Scheduler failed to enqueue reset email:', schedulerRes.error);
      return {
        success: false as const,
        status: 500,
        errors: [],
        message: 'Failed to send password reset email. Please try again later.'
      };
    }
  } catch (emailErr) {
    console.error('Failed to send reset email:', emailErr);
    return {
      success: false as const,
      status: 500,
      errors: [],
      message: 'Failed to send password reset email. Please try again later.'
    };
  }

  return {
    success: true as const,
    status: 200,
    message: 'Password reset instructions have been sent to your email.'
  };
}

export async function validateResetTokenServer(token: string) {
  const validation = validateResetTokenInput(token);
  if (!validation.success) {
    return validation;
  }

  const validToken = validation.data;
  const user = await prisma.user.findFirst({
    where: { resetToken: validToken }
  });

  if (!user) {
    return { success: false as const, status: 400, errors: [], message: 'This password reset link is invalid.' };
  }

  if (!user.resetTokenExpires || user.resetTokenExpires.getTime() < Date.now()) {
    return { success: false as const, status: 400, errors: [], message: 'This password reset link has expired.' };
  }

  if (!user.isActive) {
    return { success: false as const, status: 400, errors: [], message: 'User account is inactive.' };
  }

  return { success: true as const, status: 200, message: 'Reset token is valid', data: { valid: true } };
}

export async function resetPasswordServer(body: unknown) {
  const validation = validateResetPasswordInput(body);
  if (!validation.success) {
    return validation;
  }

  const { token, password } = validation.data;

  const user = await prisma.user.findFirst({
    where: { resetToken: token }
  });

  if (
    !user ||
    !user.resetTokenExpires ||
    user.resetTokenExpires.getTime() < Date.now() ||
    !user.isActive
  ) {
    return {
      success: false as const,
      status: 400,
      errors: [],
      message: 'The reset link is invalid or has expired'
    };
  }

  const hashedPassword = await hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpires: null
    }
  });

  return { success: true as const, status: 200, message: 'Password changed successfully' };
}

export async function changePasswordServer(userId: string, body: unknown) {
  const validation = validateChangePasswordInput(body);
  if (!validation.success) {
    return validation;
  }

  const { currentPassword, newPassword } = validation.data;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!dbUser || !dbUser.isActive) {
    return { success: false as const, status: 404, errors: [], message: 'User not found or inactive' };
  }

  if (!dbUser.password) {
    return {
      success: false as const,
      status: 400,
      errors: [],
      message: 'No password set for this account. Please use password reset.'
    };
  }

  const isMatch = await compare(currentPassword, dbUser.password);
  if (!isMatch) {
    return { success: false as const, status: 400, errors: [], message: 'Incorrect current password' };
  }

  const newHashedPassword = await hash(newPassword, 12);

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { password: newHashedPassword }
  });

  return { success: true as const, status: 200, message: 'Password updated successfully' };
}

export async function verifyEmailServer(token: string) {
  const validation = validateVerificationTokenInput(token);
  if (!validation.success) {
    return validation;
  }

  const validToken = validation.data;
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: validToken }
  });

  if (!verificationToken || verificationToken.expiresAt < new Date()) {
    return { success: false as const, status: 400, errors: [], message: 'Invalid or expired verification token' };
  }

  await prisma.user.update({
    where: { email: verificationToken.identifier },
    data: { emailVerified: new Date() }
  });

  await prisma.verificationToken.delete({
    where: { token: validToken }
  });

  return { success: true as const, status: 200, message: 'Email verified successfully' };
}
