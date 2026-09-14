/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';

import { POST as convertOrderToCodRouteHandler } from '@/app/api/orders/[id]/cod/route';
import { getCurrentUser } from '@/lib/server-auth';
import { stripe } from '@/lib/stripe/stripe-server';
import { convertOrderToCodServer } from '@/server/services/order.service';

import {
  TEST_ORDER_ID,
  mockTestOrder,
  mockTestOrderItem1,
  mockTestDeliveredOrder,
  mockTestRejectedOrder
} from '../fixtures/order.fixtures';
import {
  TEST_PAYMENT_ID,
  mockTestPaymentPending,
  mockTestPaymentSucceeded,
  mockTestPaymentFailed
} from '../fixtures/payment.fixtures';
import {
  TEST_STRIPE_PI_ID,
  mockStripePaymentIntentRequiresPaymentMethod
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

describe('Convert Order to Cash on Delivery (COD) Suite', () => {
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

  describe('convertOrderToCodServer Service', () => {
    it('successfully converts an unpaid order with pending Stripe payment to COD without creating duplicate orders', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: {
          ...mockTestPaymentPending,
          stripePaymentIntentId: TEST_STRIPE_PI_ID
        }
      });

      (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce(
        mockStripePaymentIntentRequiresPaymentMethod
      );
      (stripe.paymentIntents.cancel as jest.Mock).mockResolvedValueOnce({
        id: TEST_STRIPE_PI_ID,
        status: 'canceled'
      });

      mockPrisma.payment.delete.mockResolvedValueOnce({ id: TEST_PAYMENT_ID } as any);
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'IN_PROGRESS'
      });

      const result = await convertOrderToCodServer(TEST_ORDER_ID, TEST_USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.orderId).toBe(TEST_ORDER_ID);
        expect(result.orderNumber).toBe(mockTestOrder.orderNumber);
      }

      // Verify Stripe PaymentIntent was canceled
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(TEST_STRIPE_PI_ID);
      expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(TEST_STRIPE_PI_ID);

      // Verify DB Payment record was deleted
      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID }
      });

      // Verify Order record was updated with same ID
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: TEST_ORDER_ID },
        data: expect.objectContaining({
          status: 'IN_PROGRESS'
        })
      });
    });

    it('successfully converts an order that had a failed payment with no Stripe PI', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: {
          ...mockTestPaymentFailed,
          stripePaymentIntentId: null
        }
      });

      mockPrisma.payment.delete.mockResolvedValueOnce({ id: TEST_PAYMENT_ID } as any);
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'IN_PROGRESS'
      });

      const result = await convertOrderToCodServer(TEST_ORDER_ID, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({
        where: { id: TEST_PAYMENT_ID }
      });
    });

    it('successfully converts an order that has no payment record (already COD or initialized without payment)', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: null
      });

      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'IN_PROGRESS'
      });

      const result = await convertOrderToCodServer(TEST_ORDER_ID, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.delete).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).toHaveBeenCalled();
    });

    it('rejects with 404 when the order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      const result = await convertOrderToCodServer('non-existent-order', TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('Order not found');
    });

    it('rejects with 403 when user attempts to convert another user\'s order', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        userId: TEST_USER_2_ID,
        payment: mockTestPaymentPending
      });

      const result = await convertOrderToCodServer(TEST_ORDER_ID, TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.message).toContain('Forbidden');
    });

    it('rejects with 400 when order is already paid (SUCCEEDED)', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: mockTestPaymentSucceeded
      });

      const result = await convertOrderToCodServer(TEST_ORDER_ID, TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('already paid');
    });

    it('rejects with 400 when order is DELIVERED', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestDeliveredOrder,
        payment: mockTestPaymentPending
      });

      const result = await convertOrderToCodServer(mockTestDeliveredOrder.id, TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('delivered');
    });

    it('rejects with 400 when order is REJECTED', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestRejectedOrder,
        payment: mockTestPaymentPending
      });

      const result = await convertOrderToCodServer(mockTestRejectedOrder.id, TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toContain('rejected');
    });
  });

  describe('POST /api/orders/[id]/cod Route Handler', () => {
    it('returns 401 when user is unauthenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce(null);

      const request = createTestRequest('http://localhost:3000/api/orders/ord_123/cod', {
        method: 'POST'
      });

      const response = await convertOrderToCodRouteHandler(request, {
        params: Promise.resolve({ id: 'ord_123' })
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('returns 200 with order details on successful conversion to COD', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        ...mockTestOrder,
        payment: {
          ...mockTestPaymentPending,
          stripePaymentIntentId: null
        }
      });
      mockPrisma.payment.delete.mockResolvedValueOnce({ id: TEST_PAYMENT_ID } as any);
      mockPrisma.order.update.mockResolvedValueOnce({
        ...mockTestOrder,
        status: 'IN_PROGRESS'
      });

      const request = createTestRequest(`http://localhost:3000/api/orders/${TEST_ORDER_ID}/cod`, {
        method: 'POST'
      });

      const response = await convertOrderToCodRouteHandler(request, {
        params: Promise.resolve({ id: TEST_ORDER_ID })
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.orderId).toBe(TEST_ORDER_ID);
      expect(json.data.orderNumber).toBe(mockTestOrder.orderNumber);
    });
  });
});
