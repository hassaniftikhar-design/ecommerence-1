/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import { Decimal } from '@prisma/client/runtime/library';

import { stripe } from '@/lib/stripe/stripe-server';
import {
  getOrderByIdServer,
  updateOrderStatusServer,
  listOrdersServer,
  createOrderServer
} from '@/server/services/order.service';
import {
  getSavedPaymentMethodsServer,
  savePaymentMethodServer,
  deletePaymentMethodServer,
  createSetupIntentServer,
  getOrRefreshOrderPaymentIntentServer
} from '@/server/services/payment.service';

import {
  TEST_ORDER_ID,
  TEST_ORDER_NUMBER,
  mockTestOrder,
  mockTestOrderItem1,
  mockTestDeliveredOrder,
  mockTestRejectedOrder
} from '../fixtures/order.fixtures';
import {
  TEST_STRIPE_PM_ID,
  mockTestPaymentPending,
  mockTestPaymentSucceeded,
  mockTestPaymentFailed,
  mockTestPaymentMethod1,
  mockTestPaymentMethod2
} from '../fixtures/payment.fixtures';
import { mockStripeCardPaymentMethod } from '../fixtures/stripe.fixtures';
import {
  TEST_USER_ID,
  TEST_USER_2_ID,
  TEST_ADMIN_ID,
  mockTestUser
} from '../fixtures/user.fixtures';

describe('Order Management, State Transitions & Payment Methods Suite', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* GET ORDER BY ID & AUTHORIZATION                                            */
  /* -------------------------------------------------------------------------- */
  describe('getOrderByIdServer Authorization & Details', () => {
    it('allows an authenticated customer to view their own order with formatted totals', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            variant: { variantOptions: [] }
          }
        ],
        user: mockTestUser,
        payment: mockTestPaymentSucceeded
      });

      const result = await getOrderByIdServer(TEST_ORDER_ID, TEST_USER_ID, 'USER');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe(200);
        expect(result.order.id).toBe(TEST_ORDER_ID);
        expect(result.order.orderNumber).toBe(TEST_ORDER_NUMBER);
        expect(result.order.amount).toBe(220.0);
        expect(result.order.subTotal).toBe(200.0);
        expect(result.order.tax).toBe(20.0);
        expect(result.order.payment?.status).toBe('SUCCEEDED');
      }
    });

    it('rejects a user trying to view another user order with 403 Forbidden', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        userId: TEST_USER_2_ID, // Belongs to User 2
        items: [],
        user: { ...mockTestUser, id: TEST_USER_2_ID }
      });

      // User 1 requests User 2's order
      const result = await getOrderByIdServer(TEST_ORDER_ID, TEST_USER_ID, 'USER');

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.message).toContain('Forbidden');
    });

    it('allows an ADMIN to view any user order', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        userId: TEST_USER_ID,
        items: [
          {
            ...mockTestOrderItem1,
            variant: { variantOptions: [] }
          }
        ],
        user: mockTestUser,
        payment: mockTestPaymentSucceeded
      });

      // Admin requests User 1's order
      const result = await getOrderByIdServer(TEST_ORDER_ID, TEST_ADMIN_ID, 'ADMIN');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe(200);
        expect(result.order.id).toBe(TEST_ORDER_ID);
      }
    });

    it('returns 404 when order is not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      const result = await getOrderByIdServer('order_nonexistent', TEST_USER_ID, 'USER');

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toContain('Order not found');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* UPDATE ORDER STATUS & PAYMENT LOCKING                                      */
  /* -------------------------------------------------------------------------- */
  describe('updateOrderStatusServer Payment Locking & State Transitions', () => {
    it('blocks updating order status when payment is PENDING (400 PAYMENT_PENDING)', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: mockTestPaymentPending // Payment is PENDING
      });

      const result = await updateOrderStatusServer(TEST_ORDER_ID, 'DISPATCHED');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('PAYMENT_PENDING');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('blocks advancing order status when payment is FAILED (400 PAYMENT_FAILED)', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: mockTestPaymentFailed // Payment is FAILED
      });

      const result = await updateOrderStatusServer(TEST_ORDER_ID, 'DISPATCHED');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('PAYMENT_FAILED');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('allows advancing order status from IN_PROGRESS to DISPATCHED when payment is SUCCEEDED', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'IN_PROGRESS',
        payment: mockTestPaymentSucceeded,
        items: []
      });

      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'DISPATCHED',
        user: { name: mockTestUser.name },
        items: []
      });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_dispatch' });

      const result = await updateOrderStatusServer(TEST_ORDER_ID, 'DISPATCHED');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.order.status).toBe('DISPATCHED');
      }
    });

    it('rejects invalid state transition from DELIVERED to IN_PROGRESS with 400 INVALID_STATUS_TRANSITION', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestDeliveredOrder,
        payment: mockTestPaymentSucceeded
      });

      const result = await updateOrderStatusServer(mockTestDeliveredOrder.id, 'IN_PROGRESS');

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('INVALID_STATUS_TRANSITION');
      expect(result.message).toContain('Delivered orders cannot be modified');
    });

    it('restores stock when order is cancelled/marked REJECTED', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'IN_PROGRESS',
        payment: mockTestPaymentSucceeded,
        items: [mockTestOrderItem1]
      });

      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 8 });
      mockPrisma.productVariant.update.mockResolvedValueOnce({ id: mockTestOrderItem1.variantId, stock: 10 });
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'REJECTED',
        user: { name: mockTestUser.name },
        items: []
      });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_cancel' });

      const result = await updateOrderStatusServer(TEST_ORDER_ID, 'REJECTED');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.order.status).toBe('REJECTED');
      }

      // Verify stock incremented by item quantity
      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: mockTestOrderItem1.variantId },
        data: { stock: 8 + mockTestOrderItem1.quantity }
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SAVED PAYMENT METHOD MANAGEMENT                                            */
  /* -------------------------------------------------------------------------- */
  describe('Saved Payment Methods & SetupIntent', () => {
    it('retrieves saved payment methods formatted for user', async () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValueOnce([mockTestPaymentMethod1]);

      const result = await getSavedPaymentMethodsServer(TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.paymentMethods).toHaveLength(1);
        expect(result.data.paymentMethods[0]?.brand).toBe('visa');
        expect(result.data.paymentMethods[0]?.last4).toBe('4242');
        expect(result.data.paymentMethods[0]?.isDefault).toBe(true);
      }
    });

    it('saves card to Stripe customer and local database with upsert', async () => {
      (stripe.paymentMethods.retrieve as jest.Mock).mockResolvedValueOnce(mockStripeCardPaymentMethod);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.paymentMethod.count.mockResolvedValueOnce(0); // First card
      mockPrisma.paymentMethod.updateMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.paymentMethod.upsert.mockResolvedValueOnce(mockTestPaymentMethod1);

      const result = await savePaymentMethodServer(TEST_USER_ID, TEST_STRIPE_PM_ID, true);

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.status).toBe(201);
        expect(result.data.paymentMethod.stripePaymentMethodId).toBe(TEST_STRIPE_PM_ID);
      }
      expect(mockPrisma.paymentMethod.upsert).toHaveBeenCalled();
    });

    it('detaches and deletes payment method and reassigns default to next card', async () => {
      mockPrisma.paymentMethod.findFirst
        .mockResolvedValueOnce({
          ...mockTestPaymentMethod1,
          user: { stripeCustomerId: 'cus_test_123' }
        })
        .mockResolvedValueOnce(mockTestPaymentMethod2); // Next card to become default

      mockPrisma.paymentMethod.delete.mockResolvedValueOnce({ id: mockTestPaymentMethod1.id });
      mockPrisma.paymentMethod.update.mockResolvedValueOnce({ id: mockTestPaymentMethod2.id, isDefault: true });

      const result = await deletePaymentMethodServer(TEST_USER_ID, mockTestPaymentMethod1.id);

      expect(result.success).toBe(true);
      expect(stripe.paymentMethods.detach).toHaveBeenCalledWith(mockTestPaymentMethod1.stripePaymentMethodId);
      expect(mockPrisma.paymentMethod.delete).toHaveBeenCalledWith({
        where: { id: mockTestPaymentMethod1.id }
      });
      expect(mockPrisma.paymentMethod.update).toHaveBeenCalledWith({
        where: { id: mockTestPaymentMethod2.id },
        data: { isDefault: true }
      });
    });

    it('creates SetupIntent for saving new card', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      (stripe.setupIntents.create as jest.Mock).mockResolvedValueOnce({
        id: 'seti_test_123',
        client_secret: 'seti_test_secret_abc'
      });

      const result = await createSetupIntentServer(TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.clientSecret).toBe('seti_test_secret_abc');
      }
      expect(stripe.setupIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: mockTestUser.stripeCustomerId,
          metadata: { userId: TEST_USER_ID }
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* LIST ORDERS                                                                */
  /* -------------------------------------------------------------------------- */
  describe('listOrdersServer', () => {
    it('filters orders by userId for customer role and returns formatted summaries', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          ...mockTestOrder,
          items: [mockTestOrderItem1],
          user: { name: mockTestUser.name, email: mockTestUser.email }
        }
      ]);
      mockPrisma.order.count.mockResolvedValueOnce(1);
      mockPrisma.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: new Decimal(220.0) } });
      mockPrisma.orderItem.aggregate.mockResolvedValueOnce({ _sum: { quantity: 2 } });

      const result = await listOrdersServer({
        userId: TEST_USER_ID,
        userRole: 'USER',
        page: 1,
        limit: 10
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]?.orderNumber).toBe(TEST_ORDER_NUMBER);
      expect(result.orders[0]?.amount).toBe(220.0);
      expect(result.totalCount).toBe(1);
      expect(result.totalUnits).toBe(2);
      expect(result.totalAmount).toBe(220.0);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CREATE ORDER SERVER (DIRECT ORDER PLACEMENT)                               */
  /* -------------------------------------------------------------------------- */
  describe('createOrderServer', () => {
    it('successfully places order directly from cart', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart_1',
        userId: TEST_USER_ID,
        items: [
          {
            id: 'cart_item_1',
            productId: 'product_test_1',
            variantId: 'variant_test_1',
            quantity: 2,
            product: { id: 'product_test_1', name: 'Product 1', price: new Decimal(100.0), variants: [{ id: 'variant_test_1', images: [] }] },
            variant: { id: 'variant_test_1', images: ['https://example.com/img.jpg'], variantOptions: [] }
          }
        ]
      });

      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'product_test_1',
        isActive: true,
        name: 'Product 1',
        variants: [{ id: 'variant_test_1' }]
      });
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'order_direct_1',
        orderNumber: 'ORD-DIRECT-001',
        userId: TEST_USER_ID,
        totalAmount: 220.0
      });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_direct_1' });
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_direct' });

      const result = await createOrderServer(TEST_USER_ID, ['cart_item_1'], 220.0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe(201);
        expect(result.orderId).toBe('order_direct_1');
        expect(result.orderNumber).toBe('ORD-DIRECT-001');
      }
    });

    it('rejects direct order creation when cart is empty', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart_empty',
        userId: TEST_USER_ID,
        items: []
      });

      const result = await createOrderServer(TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('empty cart');
    });

    it('rejects direct order creation when prices have changed (409 PRICE_CHANGED)', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart_1',
        userId: TEST_USER_ID,
        items: [
          {
            id: 'cart_item_1',
            productId: 'product_test_1',
            quantity: 2,
            product: { id: 'product_test_1', name: 'Product 1', price: new Decimal(100.0), variants: [] }
          }
        ]
      });

      const result = await createOrderServer(TEST_USER_ID, ['cart_item_1'], 50.0); // Stale price

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.errors).toContain('PRICE_CHANGED');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 30: FUTURE 3-DAY EXPIRATION COMPATIBILITY                             */
  /* -------------------------------------------------------------------------- */
  describe('Step 30: Future 3-Day Unpaid Order Expiration Compatibility', () => {
    it('ensures order states permit future automated expiration: REJECTED status permanently blocks future payments', async () => {
      // Order that expired after 3 days was marked REJECTED
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestRejectedOrder,
        items: [],
        payment: mockTestPaymentFailed,
        user: mockTestUser
      });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: mockTestRejectedOrder.id,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('ORDER_NOT_PAYABLE');
      expect(result.message).toContain('rejected');
    });
  });
});
