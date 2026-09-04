/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import {
  TEST_USER_ID,
  TEST_STRIPE_CUSTOMER_ID,
  mockTestUser
} from '../fixtures/user.fixtures';
import {
  TEST_ORDER_ID,
  TEST_ORDER_NUMBER,
  mockTestOrder,
  mockTestOrderItem1
} from '../fixtures/order.fixtures';
import {
  TEST_PAYMENT_ID,
  mockTestPaymentPending,
  mockTestPaymentSucceeded,
  mockTestPaymentFailed
} from '../fixtures/payment.fixtures';
import {
  TEST_STRIPE_PI_ID,
  TEST_STRIPE_EVENT_ID,
  mockStripePaymentIntentSucceeded,
  mockStripePaymentIntentFailed,
  mockStripePaymentIntentProcessing,
  mockStripeCardPaymentMethod,
  createMockStripeWebhookEvent
} from '../fixtures/stripe.fixtures';
import { POST as stripeWebhookHandler } from '@/app/api/webhooks/stripe/route';
import { stripe } from '@/lib/stripe/stripe-server';
import { createTestRequest } from '../helpers/request.helper';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (key: string) => {
      if (key.toLowerCase() === 'stripe-signature') {
        return 'test_stripe_sig_header_valid';
      }
      return null;
    }
  })
}));

describe('Stripe Webhook Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret_key_123'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 10: PAYMENT SUCCEEDED WEBHOOK                                         */
  /* -------------------------------------------------------------------------- */
  describe('Step 10: Webhook payment_intent.succeeded', () => {
    it('marks Payment as SUCCEEDED, sets paidAt, clears cart, creates notification, and does not deduct stock a second time', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.succeeded',
        mockStripePaymentIntentSucceeded
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);

      // 1. Idempotency claim succeeds
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({
        id: mockEvent.id,
        type: mockEvent.type,
        processedAt: new Date()
      });

      // 2. Primary payment lookup by stripePaymentIntentId
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        order: mockTestOrder
      });

      // 3. Payment update to SUCCEEDED
      mockPrisma.payment.update.mockResolvedValueOnce({
        ...mockTestPaymentSucceeded
      });

      // 4. Cart lookup and deletion
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: 'cart_test_1',
        userId: TEST_USER_ID
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 1 });

      // 5. Notification create
      mockPrisma.notification.create.mockResolvedValueOnce({
        id: 'notif_1',
        userId: TEST_USER_ID
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent),
        headers: { 'stripe-signature': 'test_stripe_sig_header_valid' }
      });

      const response = await stripeWebhookHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ received: true });

      // Verify Payment record was updated with SUCCEEDED and paidAt
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: expect.objectContaining({
          status: 'SUCCEEDED',
          paidAt: expect.any(Date),
          stripePaymentIntentId: TEST_STRIPE_PI_ID,
          errorMessage: null,
          rawErrorCode: null
        })
      });

      // Verify cart was cleared
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart_test_1' }
      });

      // Verify notification was generated
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          type: 'PAYMENT_SUCCEEDED',
          orderId: TEST_ORDER_ID
        })
      });

      // CRITICAL: Verify stock was NOT deducted again (stock was already deducted upon checkout)
      expect(mockPrisma.productVariant.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('saves card for future use when metadata contains saveCardForFuture: "true"', async () => {
      const intentWithSaveCard = {
        ...mockStripePaymentIntentSucceeded,
        metadata: {
          paymentId: TEST_PAYMENT_ID,
          orderId: TEST_ORDER_ID,
          userId: TEST_USER_ID,
          saveCardForFuture: 'true'
        }
      };

      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.succeeded',
        intentWithSaveCard
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      (stripe.paymentMethods.retrieve as jest.Mock).mockResolvedValueOnce(mockStripeCardPaymentMethod);

      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        order: mockTestOrder
      });
      mockPrisma.payment.update.mockResolvedValueOnce(mockTestPaymentSucceeded);
      mockPrisma.paymentMethod.findUnique.mockResolvedValueOnce(null); // Not saved yet
      mockPrisma.paymentMethod.count.mockResolvedValueOnce(0); // First card
      mockPrisma.paymentMethod.create.mockResolvedValueOnce({ id: 'pm_saved_1' });
      mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_1' });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      expect(mockPrisma.paymentMethod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          stripePaymentMethodId: mockStripeCardPaymentMethod.id,
          brand: 'visa',
          last4: '4242',
          isDefault: true
        })
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 11 & 12: PAYMENT FAILED & STOCK RESTORATION                          */
  /* -------------------------------------------------------------------------- */
  describe('Step 11 & 12: Webhook payment_intent.payment_failed & Stock Restoration', () => {
    it('sets Payment to FAILED, keeps Order IN_PROGRESS for Pay Again, restores reserved stock once, and stores friendly decline message', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.payment_failed',
        mockStripePaymentIntentFailed
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);

      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });

      // Payment is currently PENDING with items
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        status: 'PENDING',
        order: {
          ...mockTestOrder,
          status: 'IN_PROGRESS',
          items: [mockTestOrderItem1]
        }
      });

      mockPrisma.payment.update.mockResolvedValueOnce({
        ...mockTestPaymentFailed
      });

      mockPrisma.productVariant.findFirst.mockResolvedValue(null);
      mockPrisma.productVariant.update.mockResolvedValueOnce({ id: mockTestOrderItem1.variantId });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_failed' });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      // Verify Payment record was updated to FAILED with friendly message and raw code
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: expect.objectContaining({
          status: 'FAILED',
          stripePaymentIntentId: TEST_STRIPE_PI_ID,
          errorMessage: expect.stringContaining('insufficient funds'),
          rawErrorCode: 'insufficient_funds'
        })
      });

      // Verify Order remains IN_PROGRESS (Order status MUST NOT be changed to REJECTED)
      expect(mockPrisma.order.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' })
        })
      );

      // Verify reserved stock was restored back to productVariant
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: mockTestOrderItem1.variantId },
        data: {
          stock: { increment: mockTestOrderItem1.quantity }
        }
      });

      // Verify failure notification was created
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          type: 'PAYMENT_FAILED',
          orderId: TEST_ORDER_ID
        })
      });
    });

    it('does NOT restore stock a second time if Payment is already marked FAILED', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.payment_failed',
        mockStripePaymentIntentFailed,
        'evt_second_failed_delivery'
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);

      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });

      // Payment is ALREADY FAILED
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentFailed,
        status: 'FAILED',
        order: {
          ...mockTestOrder,
          items: [mockTestOrderItem1]
        }
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      // Stock restoration should NOT execute when payment is already FAILED
      expect(mockPrisma.productVariant.update).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 13: WEBHOOK IDEMPOTENCY                                               */
  /* -------------------------------------------------------------------------- */
  describe('Step 13: Webhook Atomic Claim-First Idempotency', () => {
    it('returns 200 duplicate when the exact same Stripe event ID is delivered twice without re-executing logic', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.succeeded',
        mockStripePaymentIntentSucceeded,
        'evt_duplicate_test_123'
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      // Simulate Prisma P2002 Unique Constraint violation on StripeWebhookEvent(id)
      mockPrisma.stripeWebhookEvent.create.mockRejectedValueOnce({
        code: 'P2002',
        message: 'Unique constraint failed on StripeWebhookEvent.id'
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ received: true, duplicate: true });

      // Handlers MUST NOT run
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.productVariant.update).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 14: WEBHOOK ARRIVES BEFORE PAYMENTINTENT ID IS SAVED IN DB            */
  /* -------------------------------------------------------------------------- */
  describe('Step 14: Webhook Before PaymentIntent ID Saved (Metadata Fallback)', () => {
    it('resolves Payment via metadata.paymentId fallback when stripePaymentIntentId is not yet saved on Payment record', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.succeeded',
        mockStripePaymentIntentSucceeded
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });

      // 1. Primary lookup by stripePaymentIntentId returns null
      mockPrisma.payment.findUnique.mockResolvedValueOnce(null);

      // 2. Metadata fallback lookup by paymentId returns payment with null stripePaymentIntentId
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        stripePaymentIntentId: null,
        amount: 220.0,
        currency: 'usd',
        orderId: TEST_ORDER_ID,
        order: mockTestOrder
      });

      // 3. Updates Payment with stripePaymentIntentId, then updates status to SUCCEEDED
      mockPrisma.payment.update
        .mockResolvedValueOnce({ id: TEST_PAYMENT_ID, stripePaymentIntentId: TEST_STRIPE_PI_ID })
        .mockResolvedValueOnce({ id: TEST_PAYMENT_ID, status: 'SUCCEEDED' });

      mockPrisma.cart.findUnique.mockResolvedValueOnce(null);
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_1' });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ received: true });

      // Verify that stripePaymentIntentId was saved to the DB Payment record
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_PAYMENT_ID },
          data: expect.objectContaining({ stripePaymentIntentId: TEST_STRIPE_PI_ID })
        })
      );
    });

    it('rejects metadata fallback when amount does not match the database record', async () => {
      // PaymentIntent amount is 10000 ($100), but DB Payment amount is 220.00 ($220)
      const mismatchedIntent = {
        ...mockStripePaymentIntentSucceeded,
        amount: 10000 // $100 vs $220 in DB
      };

      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.succeeded',
        mismatchedIntent
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });

      mockPrisma.payment.findUnique.mockResolvedValueOnce(null);
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        amount: 220.0,
        currency: 'usd',
        orderId: TEST_ORDER_ID,
        order: mockTestOrder
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200); // Webhook acknowledges receipt

      // Payment MUST NOT be marked SUCCEEDED due to amount validation mismatch
      expect(mockPrisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' })
        })
      );
    });

    it('rejects metadata fallback when currency does not match the database record', async () => {
      const mismatchedCurrencyIntent = {
        ...mockStripePaymentIntentSucceeded,
        currency: 'eur' // EUR vs USD in DB
      };

      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.succeeded',
        mismatchedCurrencyIntent
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });

      mockPrisma.payment.findUnique.mockResolvedValueOnce(null);
      mockPrisma.payment.findFirst.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        amount: 220.0,
        currency: 'usd',
        orderId: TEST_ORDER_ID,
        order: mockTestOrder
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      expect(mockPrisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' })
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STEP 15 & 26-27: WEBHOOK SECURITY, STATE TRANSITIONS & ORDERING            */
  /* -------------------------------------------------------------------------- */
  describe('Step 15 & 26-27: Webhook Signature Verification, State Transitions & Ordering', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      // Create request without stripe-signature
      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_test' }),
        headers: {} // No signature
      });

      // Override mock to return null signature
      const { headers } = require('next/headers');
      headers.mockResolvedValueOnce({
        get: () => null
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Missing stripe-signature header');
    });

    it('returns 400 when Stripe signature verification fails', async () => {
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Signature verification failed');
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: 'invalid_payload',
        headers: { 'stripe-signature': 'invalid_sig' }
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Signature verification failed');
    });

    it('handles payment_intent.processing event and updates payment status to PROCESSING', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.processing',
        mockStripePaymentIntentProcessing
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        status: 'PENDING',
        order: mockTestOrder
      });
      mockPrisma.payment.update.mockResolvedValueOnce({
        ...mockTestPaymentPending,
        status: 'PROCESSING'
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: expect.objectContaining({
          status: 'PROCESSING',
          stripePaymentIntentId: TEST_STRIPE_PI_ID
        })
      });
    });

    it('does NOT overwrite SUCCEEDED payment status when a late payment_intent.processing arrives', async () => {
      const mockEvent = createMockStripeWebhookEvent(
        'payment_intent.processing',
        mockStripePaymentIntentProcessing
      );

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });

      // Payment is ALREADY SUCCEEDED
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentSucceeded,
        status: 'SUCCEEDED',
        order: mockTestOrder
      });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      // Status must NOT be moved back to PROCESSING
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('handles charge.refunded full refund and sets status to REFUNDED with refundedAt timestamp', async () => {
      const mockCharge = {
        id: 'ch_test_123',
        payment_intent: TEST_STRIPE_PI_ID,
        amount: 22000,
        amount_refunded: 22000
      };

      const mockEvent = createMockStripeWebhookEvent('charge.refunded', mockCharge);

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentSucceeded,
        order: mockTestOrder
      });
      mockPrisma.payment.update.mockResolvedValueOnce({
        ...mockTestPaymentSucceeded,
        status: 'REFUNDED'
      });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_refund' });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: expect.objectContaining({
          status: 'REFUNDED',
          refundedAt: expect.any(Date)
        })
      });
    });

    it('handles charge.refunded partial refund and sets status to PARTIALLY_REFUNDED', async () => {
      const mockCharge = {
        id: 'ch_test_123',
        payment_intent: TEST_STRIPE_PI_ID,
        amount: 22000,
        amount_refunded: 5000 // Partial refund ($50)
      };

      const mockEvent = createMockStripeWebhookEvent('charge.refunded', mockCharge);

      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce(mockEvent);
      mockPrisma.stripeWebhookEvent.create.mockResolvedValueOnce({ id: mockEvent.id });
      mockPrisma.payment.findUnique.mockResolvedValueOnce({
        ...mockTestPaymentSucceeded,
        order: mockTestOrder
      });
      mockPrisma.payment.update.mockResolvedValueOnce({
        ...mockTestPaymentSucceeded,
        status: 'PARTIALLY_REFUNDED'
      });
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif_refund' });

      const request = createTestRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(mockEvent)
      });

      const response = await stripeWebhookHandler(request);
      expect(response.status).toBe(200);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID },
        data: expect.objectContaining({
          status: 'PARTIALLY_REFUNDED',
          refundedAt: expect.any(Date)
        })
      });
    });
  });
});
