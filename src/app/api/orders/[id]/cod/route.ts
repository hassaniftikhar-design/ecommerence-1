import { apiSuccess, apiError } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/server-auth';
import { convertOrderToCodServer } from '@/server/services/order.service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in to view or retry payment', [], 401);
    }

    const { id: orderId } = await params;
    if (!orderId) {
      return apiError('Order ID is required', [], 400);
    }

    const result = await convertOrderToCodServer(orderId, userId);

    if (!result.success) {
      return apiError(result.message, result.errors || [], result.status, result.data);
    }

    return apiSuccess(
      'Order converted to Cash on Delivery successfully',
      {
        orderId: result.orderId,
        orderNumber: result.orderNumber
      },
      result.status
    );
  } catch (error) {
    return apiError('An internal server error occurred while updating order payment method', [
      (error as Error).message
    ], 500);
  }
}
