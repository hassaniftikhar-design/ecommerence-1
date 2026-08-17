import type { CartItem, CartTotals } from "@/types/cart.types";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  let json: ApiResponse<T> | null = null;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Server error (${response.status}). Please try again.`);
    }
  }

  if (!response.ok || (json && json.success === false)) {
    let errorMsg = "";

    if (json?.errors && Array.isArray(json.errors) && json.errors.length > 0) {
      errorMsg = json.errors
        .map((err) =>
          typeof err === "string"
            ? err
            : (err as { message?: string })?.message || JSON.stringify(err)
        )
        .filter(Boolean)
        .join(", ");
    }

    if (!errorMsg && json?.message) {
      errorMsg = json.message;
    }

    if (!errorMsg) {
      errorMsg = `Request failed (${response.status || "Error"}). Please try again.`;
    }

    throw new Error(errorMsg);
  }

  return (json?.data ?? json) as T;
}

function notifyCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cart-updated"));
  }
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
  const data = await parseApiResponse<CartResponseData>(response);
  notifyCartUpdated();
  return data;
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
  const data = await parseApiResponse<CartResponseData>(response);
  notifyCartUpdated();
  return data;
}

export async function removeCartItem(itemId: string): Promise<CartResponseData> {
  const response = await fetch(`/api/cart/items/${itemId}`, {
    method: "DELETE",
  });
  const data = await parseApiResponse<CartResponseData>(response);
  notifyCartUpdated();
  return data;
}

export async function clearCart(): Promise<CartResponseData> {
  const response = await fetch("/api/cart", {
    method: "DELETE",
  });
  const data = await parseApiResponse<CartResponseData>(response);
  notifyCartUpdated();
  return data;
}

export async function placeOrder(itemIds?: string[]): Promise<{ orderId: string; orderNumber: string }> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
  });
  const data = await parseApiResponse<{ orderId: string; orderNumber: string }>(response);
  notifyCartUpdated();
  return data;
}

