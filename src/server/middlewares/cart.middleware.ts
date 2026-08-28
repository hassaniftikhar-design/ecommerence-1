import { type ValidationResult } from "./validation.middleware";

export interface ValidatedAddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export function validateAddToCartInput(
  productId: string,
  quantity?: number,
  variantId?: string
): ValidationResult<ValidatedAddToCartInput> {
  if (typeof productId !== "string" || !productId.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "productId is required",
    };
  }

  const parsedQty = typeof quantity === "number" ? quantity : typeof quantity === "string" ? parseInt(quantity, 10) : 1;
  const validQty = isNaN(parsedQty) || parsedQty < 1 ? 1 : Math.floor(parsedQty);

  const cleanVariantId = typeof variantId === "string" && variantId.trim() ? variantId.trim() : undefined;

  return {
    success: true,
    data: {
      productId: productId.trim(),
      variantId: cleanVariantId,
      quantity: validQty,
    },
  };
}

export function validateCartItemQuantityInput(quantity: unknown): ValidationResult<number> {
  if (typeof quantity !== "number" || isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Quantity must be a positive integer",
    };
  }

  return {
    success: true,
    data: quantity,
  };
}

export function validateCartItemIdInput(id: unknown): ValidationResult<string> {
  if (typeof id !== "string" || !id.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Cart item ID is required",
    };
  }

  return {
    success: true,
    data: id.trim(),
  };
}
