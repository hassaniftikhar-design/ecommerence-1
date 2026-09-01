import Stripe from 'stripe';

import { prisma } from '@/lib/prisma';

import { logStripeError } from './errors';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY is missing from environment variables.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  typescript: true,
  httpClient:
    typeof Stripe.createFetchHttpClient === 'function' && typeof fetch !== 'undefined'
      ? Stripe.createFetchHttpClient(fetch)
      : undefined
});

/**
 * Retrieves existing stripeCustomerId or creates a new Stripe Customer and links it to User.
 */
export async function createOrGetStripeCustomer(params: {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const { userId, email, name, phone } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeCustomerId: true, email: true, name: true }
    });

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email: email || user?.email || undefined,
      name: name || user?.name || undefined,
      phone: phone || undefined,
      metadata: {
        userId
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id }
    });

    return customer.id;
  } catch (error) {
    logStripeError('createOrGetStripeCustomer', error, { userId, email });
    return null;
  }
}
