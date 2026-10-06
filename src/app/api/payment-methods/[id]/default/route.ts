import { apiSuccess, apiError } from '@/lib/api-response';
import { withAuth } from '@/lib/server-auth';
import { setDefaultPaymentMethodServer } from '@/server/services/payment.service';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
  async ({ userId, params }) => {
    try {
      const { id: paymentMethodRecordId } = await params;

      const result = await setDefaultPaymentMethodServer(userId, paymentMethodRecordId);

      if (!result.success) {
        return apiError(result.message, result.errors || [], result.status);
      }

      return apiSuccess(result.message, undefined, result.status);
    } catch (error) {
      return apiError('Failed to update default payment method', [
        (error as Error).message
      ], 500);
    }
  }
);

