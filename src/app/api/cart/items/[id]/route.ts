import { withAuth } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  updateCartItemQuantityServer,
  removeCartItemServer
} from '@/server/services/cart.service';

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
  async ({ request, userId, params }) => {
    return handleQuantityUpdate(request, userId, await params);
  }
);

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(
  async ({ request, userId, params }) => {
    return handleQuantityUpdate(request, userId, await params);
  }
);

async function handleQuantityUpdate(
  request: Request,
  userId: string,
  { id }: { id: string }
) {
  try {
    const body = await request.json();
    const { quantity } = body;

    const result = await updateCartItemQuantityServer(userId, id, quantity);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError('Failed to update item quantity', [(error as Error).message], 500);
  }
}

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
  async ({ userId, params }) => {
    try {
      const { id } = await params;
      const result = await removeCartItemServer(userId, id);

      if (!result.success) {
        return apiError(result.message, result.errors, result.status);
      }

      return apiSuccess(result.message, result.cartData);
    } catch (error) {
      return apiError('Failed to remove item from cart', [(error as Error).message], 500);
    }
  }
);

