import { apiSuccess, apiError } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/server-auth';
import { createCheckoutPaymentIntentServer } from '@/server/services/payment.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in to checkout', [], 401);
    }

    const body = await request.json();
    const result = await createCheckoutPaymentIntentServer({
      userId,
      itemIds: body.itemIds,
      expectedTotal: body.expectedTotal,
      savedPaymentMethodId: body.savedPaymentMethodId,
      saveCardForFuture: Boolean(body.saveCardForFuture)
    });

    if (!result.success) {
      return apiError(result.message, result.errors || [], result.status, result.data);
    }

    return apiSuccess(
      'PaymentIntent created successfully',
      {
        clientSecret: result.clientSecret,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        amount: result.amount
      },
      result.status
    );
  } catch (error) {
    return apiError('An internal server error occurred during checkout', [
      (error as Error).message
    ], 500);
  }
}
