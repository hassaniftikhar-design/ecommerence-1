import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { TEST_USER_ID, mockTestUser } from './user.fixtures';
import { mockTestProduct1, mockTestVariant1 } from './product.fixtures';
import { mockTestPaymentPending } from './payment.fixtures';

export const TEST_ORDER_ID = 'order_test_1';
export const TEST_ORDER_2_ID = 'order_test_2';
export const TEST_ORDER_NUMBER = 'ORD-TEST-001';
export const TEST_ORDER_2_NUMBER = 'ORD-TEST-002';
export const TEST_ORDER_ITEM_1_ID = 'order_item_test_1';

export const mockTestOrderItem1 = {
  id: TEST_ORDER_ITEM_1_ID,
  orderId: TEST_ORDER_ID,
  productId: mockTestProduct1.id,
  variantId: mockTestVariant1.id,
  title: mockTestProduct1.name,
  price: new Decimal(100.00),
  quantity: 2,
  stock: 10,
  imageUrl: 'https://example.com/test-prod-1.jpg',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  product: mockTestProduct1,
  variant: mockTestVariant1
};

export const mockTestOrder = {
  id: TEST_ORDER_ID,
  orderNumber: TEST_ORDER_NUMBER,
  userId: TEST_USER_ID,
  status: OrderStatus.IN_PROGRESS,
  subTotal: new Decimal(200.00),
  tax: new Decimal(20.00),
  totalAmount: new Decimal(220.00),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  user: mockTestUser,
  items: [mockTestOrderItem1],
  payment: mockTestPaymentPending
};

export const mockTestDispatchedOrder = {
  ...mockTestOrder,
  id: 'order_test_dispatched',
  orderNumber: 'ORD-TEST-DISPATCHED',
  status: OrderStatus.DISPATCHED
};

export const mockTestDeliveredOrder = {
  ...mockTestOrder,
  id: 'order_test_delivered',
  orderNumber: 'ORD-TEST-DELIVERED',
  status: OrderStatus.DELIVERED
};

export const mockTestRejectedOrder = {
  ...mockTestOrder,
  id: 'order_test_rejected',
  orderNumber: 'ORD-TEST-REJECTED',
  status: OrderStatus.REJECTED
};
