import type Stripe from 'stripe';

import { TEST_USER_ID, TEST_STRIPE_CUSTOMER_ID } from './user.fixtures';
import { TEST_ORDER_ID, TEST_ORDER_NUMBER } from './order.fixtures';
import { TEST_PAYMENT_ID, TEST_STRIPE_PM_ID } from './payment.fixtures';

export const TEST_STRIPE_PI_ID = 'pi_test_123456';
export const TEST_STRIPE_CLIENT_SECRET = 'pi_test_123456_secret_mockxyz';
export const TEST_STRIPE_EVENT_ID = 'evt_test_123456';
export const TEST_STRIPE_SETUP_INTENT_ID = 'seti_test_123456';

export const mockStripeMetadata = {
  paymentId: TEST_PAYMENT_ID,
  orderId: TEST_ORDER_ID,
  orderNumber: TEST_ORDER_NUMBER,
  userId: TEST_USER_ID,
  saveCardForFuture: 'false'
};

export const mockStripePaymentIntentRequiresPaymentMethod: Stripe.PaymentIntent = {
  id: TEST_STRIPE_PI_ID,
  object: 'payment_intent',
  amount: 22000,
  amount_received: 0,
  currency: 'usd',
  status: 'requires_payment_method',
  client_secret: TEST_STRIPE_CLIENT_SECRET,
  customer: TEST_STRIPE_CUSTOMER_ID,
  payment_method: null,
  metadata: { ...mockStripeMetadata },
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  capture_method: 'automatic',
  confirmation_method: 'automatic'
} as unknown as Stripe.PaymentIntent;

export const mockStripePaymentIntentRequiresAction: Stripe.PaymentIntent = {
  ...mockStripePaymentIntentRequiresPaymentMethod,
  status: 'requires_action'
};

export const mockStripePaymentIntentProcessing: Stripe.PaymentIntent = {
  ...mockStripePaymentIntentRequiresPaymentMethod,
  status: 'processing'
};

export const mockStripePaymentIntentSucceeded: Stripe.PaymentIntent = {
  ...mockStripePaymentIntentRequiresPaymentMethod,
  status: 'succeeded',
  amount_received: 22000,
  payment_method: TEST_STRIPE_PM_ID
};

export const mockStripePaymentIntentCanceled: Stripe.PaymentIntent = {
  ...mockStripePaymentIntentRequiresPaymentMethod,
  status: 'canceled',
  canceled_at: Math.floor(Date.now() / 1000),
  cancellation_reason: 'abandoned'
};

export const mockStripePaymentIntentFailed: Stripe.PaymentIntent = {
  ...mockStripePaymentIntentRequiresPaymentMethod,
  status: 'requires_payment_method',
  last_payment_error: {
    code: 'card_declined',
    decline_code: 'insufficient_funds',
    message: 'Your card has insufficient funds.',
    type: 'card_error'
  } as Stripe.PaymentIntent.LastPaymentError
};

export const mockStripeCardPaymentMethod: Stripe.PaymentMethod = {
  id: TEST_STRIPE_PM_ID,
  object: 'payment_method',
  type: 'card',
  customer: TEST_STRIPE_CUSTOMER_ID,
  card: {
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2028,
    funding: 'credit',
    country: 'US',
    checks: null,
    display_brand: 'visa',
    fingerprint: 'mock_fingerprint',
    generated_from: null,
    networks: null,
    three_d_secure_usage: null,
    wallet: null
  },
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  metadata: {}
} as unknown as Stripe.PaymentMethod;

export function createMockStripeWebhookEvent(
  type: string,
  dataObject: unknown,
  eventId: string = TEST_STRIPE_EVENT_ID
): Stripe.Event {
  return {
    id: eventId,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    type,
    data: {
      object: dataObject
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: 'req_test_123',
      idempotency_key: 'ik_test_123'
    }
  } as unknown as Stripe.Event;
}
