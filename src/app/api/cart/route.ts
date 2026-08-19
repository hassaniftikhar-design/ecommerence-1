import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  getCartServer,
  addToCartServer,
  clearCartServer,
} from "@/server/services/cart.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiError("Unauthorized. You must be logged in to access cart.", [], 401);
    }

    const cartData = await getCartServer(userId);
    return apiSuccess("Cart retrieved successfully", cartData);
  } catch (error) {
    return apiError("Failed to fetch cart", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiError("Unauthorized. You must be logged in to access cart.", [], 401);
    }

    const body = await request.json();
    const { productId, variantId, quantity = 1 } = body;

    if (!productId) {
      return apiError("productId is required", [], 400);
    }

    const result = await addToCartServer(userId, productId, variantId, quantity);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError("Failed to add item to cart", [(error as Error).message], 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiError("Unauthorized. You must be logged in to access cart.", [], 401);
    }

    const result = await clearCartServer(userId);
    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError("Failed to clear cart", [(error as Error).message], 500);
  }
}
