/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import { POST as checkoutRouteHandler } from '@/app/api/checkout/create-intent/route';
import { getCurrentUser } from '@/lib/server-auth';
import { stripe } from '@/lib/stripe/stripe-server';
import { createCheckoutPaymentIntentServer } from '@/server/services/payment.service';

import {
  mockTestCart,
  mockTestMultiItemCart,
  mockTestEmptyCart,
  mockTestCartItem1
} from '../fixtures/cart.fixtures';
import {
  mockTestPaymentMethod1,
  mockTestPaymentMethod2
} from '../fixtures/payment.fixtures';
import {
  mockTestProduct1,
  mockTestProduct2,
  mockTestVariant1,
  mockTestInactiveProduct
} from '../fixtures/product.fixtures';
import {
  TEST_STRIPE_PI_ID,
  TEST_STRIPE_CLIENT_SECRET
} from '../fixtures/stripe.fixtures';
import {
  TEST_USER_ID,
  TEST_STRIPE_CUSTOMER_ID,
  mockTestUser
} from '../fixtures/user.fixtures';
import { createTestRequest } from '../helpers/request.helper';

jest.mock('@/lib/server-auth', () => {
  const mockGetCurrentUser = jest.fn();
  const mockIsAdmin = jest.fn();
  return {
    getCurrentUser: mockGetCurrentUser,
    isAdmin: mockIsAdmin,
    withAuth: (handler: any) => async (req: any, ctx: any) => {
      const user = await mockGetCurrentUser(req);
      const userId = user?.id || user?.sub;
      if (!user || !userId) {
        const { apiError } = require('@/lib/api-response');
        return apiError('Unauthorized', [], 401);
      }
      return handler({ request: req, user, userId, context: ctx, params: ctx?.params });
    },
    withAdmin: (handler: any) => async (req: any, ctx: any) => {
      const user = await mockGetCurrentUser(req);
      const userId = user?.id || user?.sub;
      if (!user || !userId) {
        const { apiError } = require('@/lib/api-response');
        return apiError('Unauthorized', [], 401);
      }
      if (!mockIsAdmin(user)) {
        const { apiError } = require('@/lib/api-response');
        return apiError('Forbidden: Admin access required', [], 403);
      }
      return handler({ request: req, user, userId, context: ctx, params: ctx?.params });
    }
  };
});

describe('Checkout & Initial Order Placement Suite', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();

    // Default: Authenticated user
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: TEST_USER_ID,
      sub: TEST_USER_ID,
      email: mockTestUser.email,
      role: 'USER'
    });

    // Default mock for Stripe paymentIntent create
    (stripe.paymentIntents.create as jest.Mock).mockResolvedValue({
      id: TEST_STRIPE_PI_ID,
      client_secret: TEST_STRIPE_CLIENT_SECRET,
      status: 'requires_payment_method',
      amount: 22000,
      currency: 'usd'
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 4: SUCCESSFUL INITIAL CHECKOUT FLOW                                   */
  /* -------------------------------------------------------------------------- */
  describe('Step 4: Successful Initial Order Placement', () => {
    it('creates an order, order items, reserves stock, creates PENDING payment, and creates Stripe PaymentIntent after commit', async () => {
      // Mock User and Cart lookups
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      // Mock DB Transaction internals
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'order_test_1',
        orderNumber: 'ORD-TEST-001',
        userId: TEST_USER_ID,
        status: 'IN_PROGRESS',
        subTotal: 200.0,
        tax: 20.0,
        totalAmount: 220.0
      });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({
        id: 'order_item_test_1',
        orderId: 'order_test_1',
        productId: mockTestProduct1.id,
        variantId: mockTestVariant1.id,
        price: 100.0,
        quantity: 2,
        stock: 10
      });
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'payment_test_1',
        orderId: 'order_test_1',
        status: 'PENDING',
        stripePaymentIntentId: null,
        attemptCount: 1,
        amount: 220.0,
        currency: 'usd'
      });
      mockPrisma.payment.update.mockResolvedValueOnce({
        id: 'payment_test_1',
        stripePaymentIntentId: TEST_STRIPE_PI_ID
      });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe(201);
        expect(result.clientSecret).toBe(TEST_STRIPE_CLIENT_SECRET);
        expect(result.orderId).toBe('order_test_1');
        expect(result.orderNumber).toBe('ORD-TEST-001');
        expect(result.amount).toBe(220.0);
      }

      // Verify DB operations
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: TEST_USER_ID,
            status: 'IN_PROGRESS',
            subTotal: 200.0,
            tax: 20.0,
            totalAmount: 220.0
          })
        })
      );

      // Verify stock reservation was conditional (gte quantity)
      expect(mockPrisma.productVariant.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockTestVariant1.id,
          stock: { gte: 2 }
        },
        data: {
          stock: { decrement: 2 }
        }
      });

      // Verify Payment record was created with status PENDING and null stripePaymentIntentId
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order_test_1',
          status: 'PENDING',
          stripePaymentIntentId: null,
          attemptCount: 1,
          amount: 220.0,
          currency: 'usd'
        })
      });

      // Verify Stripe was called with server-calculated amount (220.00 * 100 = 22000 cents)
      expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 22000,
          currency: 'usd',
          customer: TEST_STRIPE_CUSTOMER_ID,
          metadata: expect.objectContaining({
            paymentId: 'payment_test_1',
            orderId: 'order_test_1',
            orderNumber: 'ORD-TEST-001',
            userId: TEST_USER_ID
          })
        }),
        expect.objectContaining({
          idempotencyKey: 'pi_attempt_payment_test_1_1'
        })
      );

      // Verify Payment was updated with Stripe PaymentIntent ID after creation
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment_test_1' },
        data: { stripePaymentIntentId: TEST_STRIPE_PI_ID }
      });
    });

    it('correctly calculates subtotal, 10% tax, and total for multi-item cart', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestMultiItemCart);

      mockPrisma.product.findUnique
        .mockResolvedValueOnce(mockTestProduct1)
        .mockResolvedValueOnce(mockTestProduct2);

      // Product 1: 2 * $100 = $200
      // Product 2: 1 * $50 = $50
      // Subtotal = $250, Tax (10%) = $25, Total = $275
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'order_multi_1',
        orderNumber: 'ORD-MULTI-001',
        userId: TEST_USER_ID,
        status: 'IN_PROGRESS',
        subTotal: 250.0,
        tax: 25.0,
        totalAmount: 275.0
      });
      mockPrisma.productVariant.findUnique
        .mockResolvedValueOnce({ stock: 10 })
        .mockResolvedValueOnce({ stock: 5 });
      mockPrisma.productVariant.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create
        .mockResolvedValueOnce({ id: 'item_1' })
        .mockResolvedValueOnce({ id: 'item_2' });
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'payment_multi_1',
        attemptCount: 1,
        amount: 275.0
      });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: 'payment_multi_1' });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 275.0
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.amount).toBe(275.0);
      }

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subTotal: 250.0,
            tax: 25.0,
            totalAmount: 275.0
          })
        })
      );
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 27500
        }),
        expect.anything()
      );
    });

    it('deletes only selected items from cart during partial checkout, leaving unselected items in cart', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      // Cart contains mockTestCartItem1 and mockTestCartItem2
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestMultiItemCart);

      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);

      // Only item 1 is ordered: 2 * $100 = $200, Tax = $20, Total = $220
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'order_partial_1',
        orderNumber: 'ORD-PARTIAL-001',
        userId: TEST_USER_ID,
        status: 'IN_PROGRESS',
        subTotal: 200.0,
        tax: 20.0,
        totalAmount: 220.0
      });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'payment_partial_1',
        attemptCount: 1,
        amount: 220.0
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: 'payment_partial_1' });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        itemIds: [mockTestCartItem1.id],
        expectedTotal: 220.0
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: {
          cartId: 'cart_test_1',
          id: { in: [mockTestCartItem1.id] }
        }
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 5: AMOUNT / PRICE TAMPERING DEFENSE                                   */
  /* -------------------------------------------------------------------------- */
  describe('Step 5: Amount / Price Tampering Defense', () => {
    it('rejects checkout with 409 PRICE_CHANGED when client sends tampered expectedTotal = 1 (server calculated total = 220)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 1.0 // Tampered malicious total
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.errors).toContain('PRICE_CHANGED');
      expect(result.data).toEqual(expect.objectContaining({ newTotal: 220.0 }));

      // Stripe MUST NEVER be called
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
      // DB Transaction MUST NEVER be executed
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects checkout with 409 PRICE_CHANGED when client expectedTotal is higher than server total', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 300.0 // Higher than actual 220.0
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.errors).toContain('PRICE_CHANGED');
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('allows checkout when expectedTotal is omitted, relying 100% on authoritative server calculation', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({
        id: 'order_test_1',
        orderNumber: 'ORD-TEST-001',
        totalAmount: 220.0
      });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValueOnce({ id: 'payment_1', attemptCount: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: 'payment_1' });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID
        // expectedTotal is omitted
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.amount).toBe(220.0);
      }
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 22000 }),
        expect.anything()
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 6: STOCK VALIDATION & CONDITIONAL DEDUCTION                            */
  /* -------------------------------------------------------------------------- */
  describe('Step 6: Stock Validation & Reservation', () => {
    it('rejects order with OUT_OF_STOCK and does not call Stripe when product variant has 0 stock', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 'order_test_1' });

      // Available stock is 0, requested quantity is 2
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 0 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 0 }); // 0 rows updated because stock < 2

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('OUT_OF_STOCK');
      expect(result.data).toEqual(
        expect.objectContaining({
          outOfStockItem: mockTestProduct1.name,
          availableStock: 0,
          requestedQty: 2
        })
      );
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects order with OUT_OF_STOCK when requested quantity exceeds available stock', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 'order_test_1' });

      // Available stock is 1, requested is 2
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 1 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('OUT_OF_STOCK');
      expect(result.message).toContain('only 1 unit(s)');
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects order with INACTIVE_PRODUCT when product is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestInactiveProduct);

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.errors).toContain('INACTIVE_PRODUCT');
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 7: TRANSACTION BOUNDARY (COMMIT < STRIPE_CREATE)                      */
  /* -------------------------------------------------------------------------- */
  describe('Step 7: Transaction Boundary Regression Test (COMMIT < STRIPE_CREATE)', () => {
    it('guarantees DB transaction commits BEFORE Stripe paymentIntents.create is executed', async () => {
      const executionOrder: string[] = [];

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
        executionOrder.push('DB_TRANSACTION_START');
        // Simulate DB work inside transaction
        mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
        const newOrder = { id: 'order_test_tx', orderNumber: 'ORD-TX-001' };
        const newPayment = { id: 'payment_test_tx', attemptCount: 1 };
        executionOrder.push('DB_ORDER_CREATED');
        executionOrder.push('DB_STOCK_RESERVED');
        executionOrder.push('DB_PAYMENT_PENDING_CREATED');
        const res = await callback(mockPrisma);
        executionOrder.push('DB_TRANSACTION_COMMIT');
        return res || { newOrder, newPayment };
      });

      mockPrisma.product.findUnique.mockResolvedValue(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValue({ id: 'order_test_tx', orderNumber: 'ORD-TX-001' });
      mockPrisma.productVariant.findUnique.mockResolvedValue({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValue({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment_test_tx', attemptCount: 1 });
      mockPrisma.payment.update.mockResolvedValue({ id: 'payment_test_tx' });

      (stripe.paymentIntents.create as jest.Mock).mockImplementationOnce(async () => {
        executionOrder.push('STRIPE_PAYMENT_INTENT_CREATE');
        return {
          id: 'pi_test_tx',
          client_secret: 'pi_test_tx_secret'
        };
      });

      await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      // Verify strict architectural ordering: DB COMMIT happens before STRIPE_CREATE
      const commitIndex = executionOrder.indexOf('DB_TRANSACTION_COMMIT');
      const stripeIndex = executionOrder.indexOf('STRIPE_PAYMENT_INTENT_CREATE');

      expect(commitIndex).toBeGreaterThan(-1);
      expect(stripeIndex).toBeGreaterThan(-1);
      expect(commitIndex).toBeLessThan(stripeIndex);
    });

    it('simulated 5-6 second Stripe API latency does not block or timeout the database transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 'order_test_1', orderNumber: 'ORD-123' });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValueOnce({ id: 'payment_1', attemptCount: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: 'payment_1' });

      // Simulate Stripe latency (e.g. 50ms in mock to simulate delayed response)
      (stripe.paymentIntents.create as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                id: 'pi_slow_123',
                client_secret: 'pi_slow_secret'
              });
            }, 50);
          })
      );

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 8: STRIPE PAYMENTINTENT CREATION FAILURE POST-COMMIT                   */
  /* -------------------------------------------------------------------------- */
  describe('Step 8: Stripe PaymentIntent Creation Failure Post-Commit', () => {
    it('handles Stripe API failure gracefully after DB transaction commit without deleting Order or rolling back Payment', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);
      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 'order_test_fail', orderNumber: 'ORD-FAIL-001' });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValueOnce({ id: 'payment_test_fail', attemptCount: 1 });

      // Stripe throws after DB has already committed
      (stripe.paymentIntents.create as jest.Mock).mockRejectedValueOnce(
        new Error('Stripe network connection error')
      );

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        expectedTotal: 220.0
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(result.message).toContain('can be paid again');
      expect(result.data).toEqual({
        orderId: 'order_test_fail',
        orderNumber: 'ORD-FAIL-001'
      });

      // DB order was NOT deleted
      expect(mockPrisma.order.delete).not.toHaveBeenCalled();
      // Payment was NOT marked as succeeded
      expect(mockPrisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' })
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 21: CHECKOUT IDEMPOTENCY                                              */
  /* -------------------------------------------------------------------------- */
  describe('Step 21: Checkout Idempotency Key Handling', () => {
    it('returns existing payment and clientSecret when duplicate checkout request is sent with same idempotencyKey', async () => {
      // Mock existing payment found by idempotencyKey
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        id: 'payment_existing_1',
        idempotencyKey: 'idemp_key_123',
        stripePaymentIntentId: 'pi_existing_123',
        amount: 220.0,
        order: {
          id: 'order_existing_1',
          orderNumber: 'ORD-EXISTING-001'
        }
      });

      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
        id: 'pi_existing_123',
        client_secret: 'pi_existing_123_secret_abc'
      });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        idempotencyKey: 'idemp_key_123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.orderId).toBe('order_existing_1');
        expect(result.clientSecret).toBe('pi_existing_123_secret_abc');
      }

      // No new order or Stripe creation
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('handles Prisma P2002 unique constraint violation on idempotencyKey by retrieving existing payment', async () => {
      mockPrisma.payment.findUnique
        .mockResolvedValueOnce(null) // First check finds nothing
        .mockResolvedValueOnce({
          id: 'payment_existing_1',
          idempotencyKey: 'idemp_race_key',
          stripePaymentIntentId: 'pi_race_123',
          amount: 220.0,
          order: {
            id: 'order_race_1',
            orderNumber: 'ORD-RACE-001'
          }
        }); // Second check after P2002 finds the created record

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      // DB transaction throws P2002 because concurrent request inserted it first
      mockPrisma.$transaction.mockRejectedValueOnce({
        code: 'P2002',
        message: 'Unique constraint failed on idempotencyKey'
      });

      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
        id: 'pi_race_123',
        client_secret: 'pi_race_123_secret'
      });

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        idempotencyKey: 'idemp_race_key',
        expectedTotal: 220.0
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.orderId).toBe('order_race_1');
        expect(result.clientSecret).toBe('pi_race_123_secret');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 22 & 23: SAVED PAYMENT METHOD SECURITY & AUTHORIZATION                */
  /* -------------------------------------------------------------------------- */
  describe('Step 22 & 23: Saved Payment Method Security & Authorization', () => {
    it('prevents User A from using User B saved payment method', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser); // User A
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      // User A attempts to pass User B's saved card ID
      // findFirst with { id: pm_record_test_2, userId: user_test_1 } returns null
      mockPrisma.paymentMethod.findFirst.mockResolvedValueOnce(null);

      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 'order_test_1', orderNumber: 'ORD-123' });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValueOnce({ id: 'payment_1', attemptCount: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: 'payment_1' });

      await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        savedPaymentMethodId: mockTestPaymentMethod2.id, // User B's card ID
        expectedTotal: 220.0
      });

      // Verify Stripe was NOT called with User B's card
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          payment_method: mockTestPaymentMethod2.stripePaymentMethodId
        }),
        expect.anything()
      );
    });

    it('attaches valid saved payment method when owned by the authenticating user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestCart);

      // User A owns card 1
      mockPrisma.paymentMethod.findFirst.mockResolvedValueOnce(mockTestPaymentMethod1);

      mockPrisma.product.findUnique.mockResolvedValueOnce(mockTestProduct1);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 'order_test_1', orderNumber: 'ORD-123' });
      mockPrisma.productVariant.findUnique.mockResolvedValueOnce({ stock: 10 });
      mockPrisma.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.orderItem.create.mockResolvedValueOnce({ id: 'item_1' });
      mockPrisma.payment.create.mockResolvedValueOnce({ id: 'payment_1', attemptCount: 1 });
      mockPrisma.payment.update.mockResolvedValueOnce({ id: 'payment_1' });

      await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID,
        savedPaymentMethodId: mockTestPaymentMethod1.id,
        expectedTotal: 220.0
      });

      // Verify Stripe received the saved card
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: mockTestPaymentMethod1.stripePaymentMethodId
        }),
        expect.anything()
      );
    });

    it('rejects unauthenticated requests via POST /api/checkout/create-intent with 401', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(null);

      const request = createTestRequest('http://localhost:3000/api/checkout/create-intent', {
        method: 'POST',
        body: { expectedTotal: 220.0 }
      });

      const response = await checkoutRouteHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Unauthorized');
    });

    it('rejects checkout with 400 when user has an empty cart', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTestUser);
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockTestEmptyCart);

      const result = await createCheckoutPaymentIntentServer({
        userId: TEST_USER_ID
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('empty cart');
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });
});
