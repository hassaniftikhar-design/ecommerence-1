/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import { Decimal } from '@prisma/client/runtime/library';

import { POST as orderPaymentIntentRouteHandler } from '@/app/api/orders/[id]/payment-intent/route';
import { getCurrentUser } from '@/lib/server-auth';
import { stripe } from '@/lib/stripe/stripe-server';
import { getOrRefreshOrderPaymentIntentServer } from '@/server/services/payment.service';

import {
  TEST_ORDER_ID,
  mockTestOrder,
  mockTestOrderItem1,
  mockTestDeliveredOrder
} from '../fixtures/order.fixtures';
import {
  TEST_PAYMENT_ID,
  mockTestPaymentPending,
  mockTestPaymentSucceeded,
  mockTestPaymentFailed
} from '../fixtures/payment.fixtures';
import {
  mockTestProduct1,
  mockTestVariant1
} from '../fixtures/product.fixtures';
import {
  TEST_STRIPE_PI_ID,
  TEST_STRIPE_CLIENT_SECRET,
  mockStripePaymentIntentRequiresPaymentMethod,
  mockStripePaymentIntentProcessing,
  mockStripePaymentIntentSucceeded,
  mockStripePaymentIntentCanceled
} from '../fixtures/stripe.fixtures';
import {
  TEST_USER_ID,
  TEST_USER_2_ID,
  mockTestUser
} from '../fixtures/user.fixtures';
import { createTestRequest } from '../helpers/request.helper';

jest.mock('@/lib/server-auth', () => ({
  getCurrentUser: jest.fn(),
  isAdmin: jest.fn()
}));

describe('Pay Again & Payment Retry Suite', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();

    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: TEST_USER_ID,
      sub: TEST_USER_ID,
      email: mockTestUser.email,
      role: 'USER'
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 9 & 16: PAY AGAIN / RETRY ON SAME ORDER                               */
  /* -------------------------------------------------------------------------- */
  describe('Step 9 & 16: Pay Again on Same Order with Stripe State Inspection', () => {
    it('operates on the existing order and reuses existing PaymentIntent when status is requires_payment_method', async () => {
      // Order lookup
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          stripePaymentIntentId: TEST_STRIPE_PI_ID,
          attemptCount: 1
        },
        user: mockTestUser
      });

      // Stripe check: Intent is reusable
      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentRequiresPaymentMethod
      );

      // Re-reserve stock inside DB transaction because previous payment was FAILED
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'PENDING' });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.orderId).toBe(TEST_ORDER_ID);
        expect(result.clientSecret).toBe(TEST_STRIPE_CLIENT_SECRET);
        expect(result.amount).toBe(220.0);
      }

      // Existing intent was reused, NO new Stripe intent created
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(TEST_STRIPE_PI_ID);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
      // NO new order created
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('creates replacement PaymentIntent when existing Stripe intent is canceled', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          stripePaymentIntentId: 'pi_canceled_123',
          attemptCount: 1
        },
        user: mockTestUser
      });

      // Stripe check: Intent is canceled
      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentCanceled
      );

      // Stock re-reservation
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'PENDING' });

      // Atomic attempt claim succeeds: increments attemptCount to 2
      mockPrisma.payment.updateMany.mockResolvedValueOnce({ count: 1 });

      // Stripe creates new intent with attempt-scoped idempotency key
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
        id: 'pi_replacement_456',
        client_secret: 'pi_replacement_secret_xyz'
      });

      mockPrisma.payment.update.mockResolvedValueOnce({
        id: TEST_PAYMENT_ID,
        stripePaymentIntentId: 'pi_replacement_456'
      });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.clientSecret).toBe('pi_replacement_secret_xyz');
      }

      // Verify Stripe was called with attempt-scoped idempotency key: pi_attempt_payment_test_1_2
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 22000,
          currency: 'usd',
          metadata: expect.objectContaining({
            paymentId: TEST_PAYMENT_ID,
            orderId: TEST_ORDER_ID,
            userId: TEST_USER_ID
          })
        }),
        expect.objectContaining({
          idempotencyKey: `pi_attempt_${TEST_PAYMENT_ID}_2`
        })
      );
    });

    it('returns isPaid: true without deducting stock when order or Stripe intent is already succeeded', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentPending,
          stripePaymentIntentId: TEST_STRIPE_PI_ID
        },
        user: mockTestUser
      });

      // Stripe intent returns succeeded
      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentSucceeded
      );

      mockPrisma.payment.update.mockResolvedValueOnce({
        id: TEST_PAYMENT_ID,
        status: 'SUCCEEDED'
      });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isPaid).toBe(true);
        expect(result.message).toContain('already paid');
      }

      // No stock deduction and no new Stripe intent
      expect(mockPrisma.productVariant.updateMany).not.toHaveBeenCalled();
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('returns 409 PAYMENT_PROCESSING when Stripe intent is in processing state', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentPending,
          stripePaymentIntentId: TEST_STRIPE_PI_ID
        },
        user: mockTestUser
      });

      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentProcessing
      );

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.errors).toContain('PAYMENT_PROCESSING');
      expect(mockPrisma.productVariant.updateMany).not.toHaveBeenCalled();
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects Pay Again on non-payable orders (DELIVERED or REJECTED) with 400', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestDeliveredOrder,
        items: [],
        payment: mockTestPaymentSucceeded,
        user: mockTestUser
      });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: mockTestDeliveredOrder.id,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('ORDER_NOT_PAYABLE');
    });

    it('rejects unauthorized user attempting to access another user order with 404', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        userId: TEST_USER_2_ID, // Belongs to User 2
        items: [],
        payment: mockTestPaymentPending,
        user: { id: TEST_USER_2_ID }
      });

      // User 1 requests User 2's order
      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.errors).toContain('ORDER_NOT_FOUND');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 17: PAY AGAIN PRICE CHANGE DETECTION                                  */
  /* -------------------------------------------------------------------------- */
  describe('Step 17: Pay Again Price Change Revalidation', () => {
    it('detects when product price in DB changed from $100 to $120 and returns 409 PRICE_CHANGED without charging stale price', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            price: new Decimal(100.00), // Original order price was $100
            product: {
              id: mockTestProduct1.id,
              name: mockTestProduct1.name,
              price: new Decimal(120.00), // New DB price is $120
              isActive: true
            },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          stripePaymentIntentId: null
        },
        user: mockTestUser
      });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.errors).toContain('PRICE_CHANGED');
      expect(result.data).toEqual({
        productId: mockTestProduct1.id,
        oldPrice: 100.0,
        currentPrice: 120.0
      });

      // Stripe MUST NOT be charged stale price
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
      // Stock MUST NOT be reserved
      expect(mockPrisma.productVariant.updateMany).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 18: PAY AGAIN OUT OF STOCK                                            */
  /* -------------------------------------------------------------------------- */
  describe('Step 18: Pay Again Out of Stock Validation', () => {
    it('rejects Pay Again with 400 OUT_OF_STOCK when remaining stock is less than order quantity', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            quantity: 2,
            price: new Decimal(100.00),
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 1 } // Only 1 in stock, requested 2
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          status: 'FAILED',
          stripePaymentIntentId: null
        },
        user: mockTestUser
      });

      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 1 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 0 }); // Conditional reservation fails

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('OUT_OF_STOCK');
      expect(result.data).toEqual(
        expect.objectContaining({
          outOfStockItem: mockTestOrderItem1.title,
          availableStock: 1,
          requestedQty: 2
        })
      );
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 19 & 20: STOCK RE-RESERVATION & CONCURRENT RETRY CLAIM                */
  /* -------------------------------------------------------------------------- */
  describe('Step 19 & 20: Stock Re-Reservation & Atomic Concurrent Retry Claim', () => {
    it('re-reserves stock atomically inside DB transaction when payment was previously FAILED', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            quantity: 2,
            price: new Decimal(100.00),
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          status: 'FAILED',
          stripePaymentIntentId: null,
          attemptCount: 1
        },
        user: mockTestUser
      });

      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'PENDING' });

      (stripe.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
        id: 'pi_retry_123',
        client_secret: 'pi_retry_secret'
      });

      mockPrisma.payment.update.mockResolvedValueOnce({
        id: TEST_PAYMENT_ID,
        stripePaymentIntentId: 'pi_retry_123'
      });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(true);

      // Verify stock was decremented during re-reservation
      expect(mockPrisma.productVariant.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockTestVariant1.id,
          stock: { gte: 2 }
        },
        data: {
          stock: { decrement: 2 }
        }
      });
    });

    it('safely handles concurrent retry attempts using atomic claim count', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          stripePaymentIntentId: 'pi_canceled_123',
          attemptCount: 1
        },
        user: mockTestUser
      });

      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentCanceled
      );

      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'PENDING' });

      // Request B loses race: updateMany count is 0 because Request A already incremented attemptCount
      mockPrisma.payment.updateMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        id: TEST_PAYMENT_ID,
        attemptCount: 2 // Refreshed value from the winning attempt
      });

      (stripe.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
        id: 'pi_attempt_2',
        client_secret: 'pi_attempt_2_secret'
      });

      mockPrisma.payment.update.mockResolvedValueOnce({ id: TEST_PAYMENT_ID });

      const result = await getOrRefreshOrderPaymentIntentServer({
        orderId: TEST_ORDER_ID,
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(true);
      // Stripe idempotency key matched attempt 2
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          idempotencyKey: `pi_attempt_${TEST_PAYMENT_ID}_2`
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* ROUTE HANDLER: POST /api/orders/[id]/payment-intent                        */
  /* -------------------------------------------------------------------------- */
  describe('Route: POST /api/orders/[id]/payment-intent', () => {
    it('returns 401 when request is unauthenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(null);

      const request = createTestRequest('http://localhost:3000/api/orders/order_123/payment-intent', {
        method: 'POST'
      });

      const response = await orderPaymentIntentRouteHandler(request, {
        params: Promise.resolve({ id: 'order_123' })
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 200 with payment intent clientSecret when authenticated owner retries payment', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        items: [
          {
            ...mockTestOrderItem1,
            product: { id: mockTestProduct1.id, name: mockTestProduct1.name, price: new Decimal(100.00), isActive: true },
            variant: { id: mockTestVariant1.id, stock: 10 }
          }
        ],
        payment: {
          ...mockTestPaymentFailed,
          stripePaymentIntentId: TEST_STRIPE_PI_ID
        },
        user: mockTestUser
      });

      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentRequiresPaymentMethod
      );

      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'PENDING' });

      const request = createTestRequest(`http://localhost:3000/api/orders/${TEST_ORDER_ID}/payment-intent`, {
        method: 'POST'
      });

      const response = await orderPaymentIntentRouteHandler(request, {
        params: Promise.resolve({ id: TEST_ORDER_ID })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.clientSecret).toBe(TEST_STRIPE_CLIENT_SECRET);
      expect(data.data.orderId).toBe(TEST_ORDER_ID);
    });
  });
});
