import { apiSuccess, apiError } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/server-auth';
import { setDefaultPaymentMethodServer } from '@/server/services/payment.service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodRecordId } = await params;
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in', [], 401);
    }

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
