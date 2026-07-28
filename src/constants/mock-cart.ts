import type { CartItem, CartTotals } from "@/types/cart.types";

// TODO(backend-integration): stand-in for cart.service.ts#getCart(),
// which will read from a session-scoped cart (Prisma + NextAuth
// session) once the backend exists.
export const MOCK_CART_ITEMS: CartItem[] = Array.from(
  { length: 8 },
  (_, i) => ({
    id: `cart-item-${i + 1}`,
    productId: "8",
    name: "Cargo Trousers for Men - 6 Pocket Trousers - 6 Pocket Cargo Trousers in all Colors - Cargo Trouser",
    imageUrl: "https://placehold.co/80x80/f8f9fa/212529?text=Trouser",
    color: { name: "Bage", hex: "#c39267" },
    size: "34",
    price: 0,
    quantity: 2,
  }),
);

// TODO(backend-integration): real totals will be computed server-side
// (or derived client-side from live cart state) once pricing exists.
// Kept as a flat constant for now since every price in Phase 1 is $0.
export const MOCK_CART_TOTALS: CartTotals = {
  subTotal: 0,
  tax: 0,
  total: 0,
};
