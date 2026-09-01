import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { mockRegularUser } from './auth.mock';

export const MOCK_ORDER_ID = 'order-cuid-12345';
export const MOCK_ORDER_NUMBER = 'ORD-987654';

export const mockOrderItem = {
  id: 'order-item-cuid-1',
  orderId: MOCK_ORDER_ID,
  productId: 'product-cuid-1',
  variantId: 'variant-cuid-1',
  title: 'Wireless Noise Cancelling Headphones',
  price: new Decimal(99.99),
  quantity: 2,
  stock: 10,
  imageUrl: 'https://example.com/image1.jpg',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  product: {
    id: 'product-cuid-1',
    name: 'Wireless Noise Cancelling Headphones',
    category: { id: 'category-cuid-1', name: 'Electronics' }
  },
  variant: {
    id: 'variant-cuid-1',
    sku: 'ELEC-PROD-1-RED-M'
  }
};

export const mockOrder = {
  id: MOCK_ORDER_ID,
  orderNumber: MOCK_ORDER_NUMBER,
  userId: mockRegularUser.id,
  status: OrderStatus.IN_PROGRESS,
  subTotal: new Decimal(199.98),
  tax: new Decimal(0),
  totalAmount: new Decimal(199.98),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  user: {
    id: mockRegularUser.id,
    name: mockRegularUser.name,
    email: mockRegularUser.email
  },
  items: [mockOrderItem]
};

export const mockOrdersList = [
  mockOrder,
  {
    ...mockOrder,
    id: 'order-cuid-2',
    orderNumber: 'ORD-112233',
    status: OrderStatus.DISPATCHED
  },
  {
    ...mockOrder,
    id: 'order-cuid-3',
    orderNumber: 'ORD-445566',
    status: OrderStatus.DELIVERED
  },
  {
    ...mockOrder,
    id: 'order-cuid-4',
    orderNumber: 'ORD-778899',
    status: OrderStatus.REJECTED
  }
];
