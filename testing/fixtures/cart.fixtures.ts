import { TEST_USER_ID } from './user.fixtures';
import {
  mockTestProduct1,
  mockTestProduct2,
  mockTestVariant1,
  mockTestVariant2
} from './product.fixtures';

export const TEST_CART_ID = 'cart_test_1';
export const TEST_CART_ITEM_1_ID = 'cart_item_test_1';
export const TEST_CART_ITEM_2_ID = 'cart_item_test_2';

export const mockTestCartItem1 = {
  id: TEST_CART_ITEM_1_ID,
  cartId: TEST_CART_ID,
  productId: mockTestProduct1.id,
  variantId: mockTestVariant1.id,
  quantity: 2,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  product: mockTestProduct1,
  variant: mockTestVariant1
};

export const mockTestCartItem2 = {
  id: TEST_CART_ITEM_2_ID,
  cartId: TEST_CART_ID,
  productId: mockTestProduct2.id,
  variantId: mockTestVariant2.id,
  quantity: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  product: mockTestProduct2,
  variant: mockTestVariant2
};

export const mockTestCart = {
  id: TEST_CART_ID,
  userId: TEST_USER_ID,
  sessionId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  items: [mockTestCartItem1]
};

export const mockTestMultiItemCart = {
  id: TEST_CART_ID,
  userId: TEST_USER_ID,
  sessionId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  items: [mockTestCartItem1, mockTestCartItem2]
};

export const mockTestEmptyCart = {
  id: 'cart_test_empty',
  userId: TEST_USER_ID,
  sessionId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  items: []
};
