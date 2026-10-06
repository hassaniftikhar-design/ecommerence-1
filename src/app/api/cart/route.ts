import { withAuth } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  getCartServer,
  addToCartServer,
  clearCartServer
} from '@/server/services/cart.service';

export const GET = withAuth(async ({ userId }) => {
  try {
    const cartData = await getCartServer(userId);
    return apiSuccess('Cart retrieved successfully', cartData);
  } catch (error) {
    return apiError('Failed to fetch cart', [(error as Error).message], 500);
  }
});

export const POST = withAuth(async ({ request, userId }) => {
  try {
    const body = await request.json();
    const { productId, variantId, quantity = 1 } = body;

    if (!productId) {
      return apiError('productId is required', [], 400);
    }

    const result = await addToCartServer(userId, productId, variantId, quantity);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError('Failed to add item to cart', [(error as Error).message], 500);
  }
});

export const DELETE = withAuth(async ({ request, userId }) => {
  try {
    let itemIds: string[] | undefined = undefined;
    try {
      const body = await request.json();
      if (body && Array.isArray(body.itemIds)) {
        itemIds = body.itemIds;
      }
    } catch {
      // Body is empty -> clear cart
    }

    let result;
    if (itemIds && itemIds.length > 0) {
      const { removeMultipleCartItemsServer } = await import('@/server/services/cart.service');
      result = await removeMultipleCartItemsServer(userId, itemIds);
    } else {
      result = await clearCartServer(userId);
    }

    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError('Failed to remove items from cart', [(error as Error).message], 500);
  }
});

