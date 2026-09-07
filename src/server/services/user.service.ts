import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/stripe-server';
import { logStripeError } from '@/lib/stripe/errors';
import { validateUpdateUserAddressInput } from '@/server/middlewares';
import type { UserAddress } from '@/types/user.types';

export async function getUserAddressServer(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      addressLine: true,
      city: true,
      postalCode: true,
      country: true
    }
  });

  if (!dbUser) {
    return {
      success: false as const,
      status: 404,
      errors: ['User not found'],
      message: 'User not found'
    };
  }

  const address: UserAddress = {
    addressLine: dbUser.addressLine || '',
    city: dbUser.city || '',
    postalCode: dbUser.postalCode || '',
    country: dbUser.country || '',
    phone: dbUser.phone || '',
    name: dbUser.name || '',
    email: dbUser.email || ''
  };

  return {
    success: true as const,
    status: 200,
    message: 'User address retrieved successfully',
    address
  };
}

export async function updateUserAddressServer(userId: string, body: unknown) {
  const validation = validateUpdateUserAddressInput(body);
  if (!validation.success) {
    return validation;
  }

  const { addressLine, city, postalCode, country, phone, name } = validation.data;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      addressLine,
      city,
      postalCode,
      country,
      ...(phone !== undefined ? { phone } : {})
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      addressLine: true,
      city: true,
      postalCode: true,
      country: true,
      stripeCustomerId: true
    }
  });

  // If user has a Stripe Customer, sync the address on Stripe
  if (updatedUser.stripeCustomerId) {
    try {
      await stripe.customers.update(updatedUser.stripeCustomerId, {
        name: updatedUser.name || undefined,
        address: {
          line1: updatedUser.addressLine || undefined,
          city: updatedUser.city || undefined,
          postal_code: updatedUser.postalCode || undefined,
          country: updatedUser.country || undefined
        },
        shipping: {
          name: updatedUser.name || 'Recipient',
          phone: updatedUser.phone || undefined,
          address: {
            line1: updatedUser.addressLine || undefined,
            city: updatedUser.city || undefined,
            postal_code: updatedUser.postalCode || undefined,
            country: updatedUser.country || undefined
          }
        }
      });
    } catch (stripeErr) {
      logStripeError('updateUserAddress:stripeSync', stripeErr, {
        customerId: updatedUser.stripeCustomerId
      });
    }
  }

  const address: UserAddress = {
    addressLine: updatedUser.addressLine || '',
    city: updatedUser.city || '',
    postalCode: updatedUser.postalCode || '',
    country: updatedUser.country || '',
    phone: updatedUser.phone || '',
    name: updatedUser.name || '',
    email: updatedUser.email || ''
  };

  return {
    success: true as const,
    status: 200,
    message: 'Address updated successfully',
    address
  };
}
