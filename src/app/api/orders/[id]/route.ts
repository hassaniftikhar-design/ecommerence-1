import type { OrderStatus } from '@prisma/client';

import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  getOrderByIdServer,
  updateOrderStatusServer
} from '@/server/services/order.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    const result = await getOrderByIdServer(id, userId, user?.role);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess('Order retrieved successfully', { order: result.order });
  } catch (error) {
    return apiError('Failed to fetch order', [(error as Error).message], 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can update order status', [], 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: OrderStatus };

    const result = await updateOrderStatusServer(id, status);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess('Order status updated successfully', { order: result.order });
  } catch (error) {
    return apiError('Failed to update order status', [(error as Error).message], 500);
  }
}
