import { Decimal } from "@prisma/client/runtime/library";
import { mockVariant, mockProduct } from "./product.mock";

export const MOCK_CART_ID = "cart-cuid-12345";
export const MOCK_CART_ITEM_ID = "cart-item-cuid-1";

export const mockCartItem = {
  id: MOCK_CART_ITEM_ID,
  cartId: MOCK_CART_ID,
  productId: mockProduct.id,
  variantId: mockVariant.id,
  quantity: 2,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  product: {
    ...mockProduct,
    price: new Decimal(99.99),
  },
  variant: mockVariant,
};

export const mockCart = {
  id: MOCK_CART_ID,
  userId: "user-cuid-12345",
  sessionId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  items: [mockCartItem],
};

export const mockEmptyCart = {
  id: "cart-empty-id",
  userId: "user-cuid-empty",
  sessionId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  items: [],
};
