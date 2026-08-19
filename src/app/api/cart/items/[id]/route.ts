import { apiSuccess, apiError } from "@/lib/api-response";
import {
  updateCartItemQuantityServer,
  removeCartItemServer,
} from "@/server/services/cart.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleQuantityUpdate(request, await params);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleQuantityUpdate(request, await params);
}

async function handleQuantityUpdate(
  request: Request,
  { id }: { id: string }
) {
  try {
    const body = await request.json();
    const { quantity } = body;

    const result = await updateCartItemQuantityServer(id, quantity);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError("Failed to update item quantity", [(error as Error).message], 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await removeCartItemServer(id);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.cartData);
  } catch (error) {
    return apiError("Failed to remove item from cart", [(error as Error).message], 500);
  }
}
