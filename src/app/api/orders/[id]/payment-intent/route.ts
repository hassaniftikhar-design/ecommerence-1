import { apiSuccess, apiError } from '@/lib/api-response';
import { withAuth } from '@/lib/server-auth';
import { getOrRefreshOrderPaymentIntentServer } from '@/server/services/payment.service';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async ({ request, userId, params }) => {
    try {
      const { id: orderId } = await params;
      if (!orderId) {
        return apiError('Order ID is required', [], 400);
      }

      let body: { savedPaymentMethodId?: string; acceptPriceUpdate?: boolean } = {};
      try {
        body = await request.json();
      } catch {
        // Body may be empty if no savedPaymentMethodId is passed
      }

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId,
        userId,
        savedPaymentMethodId: body.savedPaymentMethodId,
        acceptPriceUpdate: Boolean(body.acceptPriceUpdate)
      });

      if (!result.success) {
        return apiError(result.message, result.errors || [], result.status, result.data);
      }

      return apiSuccess(
        result.message || 'Payment intent retrieved successfully',
        {
          clientSecret: result.clientSecret,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: result.amount,
          isPaid: result.isPaid
        },
        result.status
      );
    } catch (error) {
      return apiError('An internal server error occurred while retrieving payment intent', [
        (error as Error).message
      ], 500);
    }
  }
);

