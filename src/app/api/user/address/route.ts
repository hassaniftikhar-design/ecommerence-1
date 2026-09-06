import { apiSuccess, apiError } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/stripe-server';
import { logStripeError } from '@/lib/stripe/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in', [], 401);
    }

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
      return apiError('User not found', [], 404);
    }

    return apiSuccess('User address retrieved successfully', {
      address: {
        addressLine: dbUser.addressLine || '',
        city: dbUser.city || '',
        postalCode: dbUser.postalCode || '',
        country: dbUser.country || '',
        phone: dbUser.phone || '',
        name: dbUser.name || '',
        email: dbUser.email || ''
      }
    });
  } catch (error) {
    return apiError('Failed to fetch address', [(error as Error).message], 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in', [], 401);
    }

    const body = await request.json();
    const { addressLine, city, postalCode, country, phone, name } = body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return apiError('Full name cannot be empty', ['name cannot be empty'], 400);
    }
    if (!addressLine || typeof addressLine !== 'string' || !addressLine.trim()) {
      return apiError('Address line is required', ['addressLine is required'], 400);
    }
    if (!city || typeof city !== 'string' || !city.trim()) {
      return apiError('City is required', ['city is required'], 400);
    }
    if (!postalCode || typeof postalCode !== 'string' || !postalCode.trim()) {
      return apiError('Postal / Zip code is required', ['postalCode is required'], 400);
    }
    if (!country || typeof country !== 'string' || !country.trim()) {
      return apiError('Country is required', ['country is required'], 400);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        addressLine: addressLine.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        ...(phone !== undefined ? { phone: typeof phone === 'string' ? phone.trim() : null } : {})
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

    return apiSuccess('Address updated successfully', {
      address: {
        addressLine: updatedUser.addressLine || '',
        city: updatedUser.city || '',
        postalCode: updatedUser.postalCode || '',
        country: updatedUser.country || '',
        phone: updatedUser.phone || '',
        name: updatedUser.name || '',
        email: updatedUser.email || ''
      }
    });
  } catch (error) {
    return apiError('Failed to update address', [(error as Error).message], 500);
  }
}
