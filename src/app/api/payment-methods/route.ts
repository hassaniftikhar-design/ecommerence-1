import { apiSuccess, apiError } from '@/lib/api-response';
import { withAuth } from '@/lib/server-auth';
import {
  getSavedPaymentMethodsServer,
  savePaymentMethodServer
} from '@/server/services/payment.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async ({ userId }) => {
  try {
    const result = await getSavedPaymentMethodsServer(userId);

    if (!result.success) {
      return apiError(result.message, result.errors || [], result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError('Failed to fetch payment methods', [
      (error as Error).message
    ], 500);
  }
});

export const POST = withAuth(async ({ request, userId }) => {
  try {
    const body = await request.json();
    const result = await savePaymentMethodServer(userId, body.paymentMethodId, body.setAsDefault);

    if (!result.success) {
      return apiError(result.message, result.errors || [], result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError('Failed to save payment method', [
      (error as Error).message
    ], 500);
  }
});

