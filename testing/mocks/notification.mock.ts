import { mockRegularUser } from './auth.mock';

export const mockNotification = {
  id: 'notif-cuid-1',
  userId: mockRegularUser.id,
  title: 'Order Placed',
  message: 'Your order ORD-987654 has been placed successfully.',
  type: 'ORDER_CREATED',
  orderId: 'order-cuid-12345',
  isRead: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
};

export const mockNotificationsList = [
  mockNotification,
  {
    ...mockNotification,
    id: 'notif-cuid-2',
    title: 'Order Dispatched',
    message: 'Your order has been dispatched.',
    type: 'ORDER_DISPATCHED',
    isRead: false
  },
  {
    ...mockNotification,
    id: 'notif-cuid-3',
    title: 'Welcome',
    message: 'Welcome to our store!',
    type: 'WELCOME',
    isRead: true
  }
];
