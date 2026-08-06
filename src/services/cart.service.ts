import type { CartItem, CartTotals } from "@/types/cart.types";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const json: ApiResponse<T> = await response.json();
  if (!response.ok || !json.success) {
    const errorMsg =
      json.errors && json.errors.length > 0
        ? json.errors.join(", ")
        : json.message || "Request failed";
    throw new Error(errorMsg);
  }
  return json.data as T;
}

export interface CartResponseData {
  cartId?: string;
  items: CartItem[];
  totals: CartTotals;
}

export async function getCart(): Promise<CartResponseData> {
  const response = await fetch("/api/cart", {
    cache: "no-store",
  });
  return parseApiResponse<CartResponseData>(response);
}

export async function addToCart(
  productId: string,
  variantId?: string | null,
  quantity = 1
): Promise<CartResponseData> {
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, variantId, quantity }),
  });
  return parseApiResponse<CartResponseData>(response);
}

export async function updateCartItemQuantity(
  itemId: string,
  quantity: number
): Promise<CartResponseData> {
  const response = await fetch(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  return parseApiResponse<CartResponseData>(response);
}

export async function removeCartItem(itemId: string): Promise<CartResponseData> {
  const response = await fetch(`/api/cart/items/${itemId}`, {
    method: "DELETE",
  });
  return parseApiResponse<CartResponseData>(response);
}

export async function clearCart(): Promise<CartResponseData> {
  const response = await fetch("/api/cart", {
    method: "DELETE",
  });
  return parseApiResponse<CartResponseData>(response);
}

export async function placeOrder(): Promise<{ orderId: string }> {
  const response = await fetch("/api/orders", {
    method: "POST",
  });
  return parseApiResponse<{ orderId: string }>(response);
}

