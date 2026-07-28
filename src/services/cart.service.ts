import type { CartItem, CartTotals } from "@/types/cart.types";

// Same pattern as auth.service.ts / product.service.ts: real fetch
// calls land here once Route Handlers + Prisma exist. Components
// already import from this file so that swap never touches JSX.

export async function getCart(): Promise<{
  items: CartItem[];
  totals: CartTotals;
}> {
  throw new Error("Not implemented");
}

export async function updateCartItemQuantity(
  _itemId: string,
  _quantity: number,
): Promise<void> {
  throw new Error("Not implemented");
}

export async function removeCartItem(_itemId: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function placeOrder(): Promise<{ orderId: string }> {
  throw new Error("Not implemented");
}
