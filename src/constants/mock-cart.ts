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
    imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80",
    color: { name: "Bage", hex: "#c39267" },
    size: "34",
    price: 0,
    quantity: 2,
    totalPrice: 0,
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
                                 