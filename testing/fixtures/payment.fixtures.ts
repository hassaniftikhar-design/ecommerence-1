import { PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { TEST_USER_ID, TEST_USER_2_ID } from './user.fixtures';

export const TEST_PAYMENT_ID = 'payment_test_1';
export const TEST_PAYMENT_2_ID = 'payment_test_2';
export const TEST_PAYMENT_METHOD_ID = 'pm_record_test_1';
export const TEST_PAYMENT_METHOD_2_ID = 'pm_record_test_2';
export const TEST_STRIPE_PM_ID = 'pm_test_card_123';
export const TEST_STRIPE_PM_2_ID = 'pm_test_card_456';

export const mockTestPaymentMethod1 = {
  id: TEST_PAYMENT_METHOD_ID,
  userId: TEST_USER_ID,
  stripePaymentMethodId: TEST_STRIPE_PM_ID,
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2028,
  isDefault: true,
  createdAt: new Date('2026-01-01T00:00:00Z')
};

export const mockTestPaymentMethod2 = {
  id: TEST_PAYMENT_METHOD_2_ID,
  userId: TEST_USER_2_ID,
  stripePaymentMethodId: TEST_STRIPE_PM_2_ID,
  brand: 'mastercard',
  last4: '5555',
  expMonth: 11,
  expYear: 2029,
  isDefault: true,
  createdAt: new Date('2026-01-01T00:00:00Z')
};

export const mockTestPaymentPending = {
  id: TEST_PAYMENT_ID,
  orderId: 'order_test_1',
  status: PaymentStatus.PENDING,
  stripePaymentIntentId: null as string | null,
  stripePaymentMethodId: null as string | null,
  stripeCustomerId: 'cus_test_123',
  idempotencyKey: null as string | null,
  attemptCount: 1,
  amount: new Decimal(220.00),
  currency: 'usd',
  paidAt: null as Date | null,
  refundedAt: null as Date | null,
  errorMessage: null as string | null,
  rawErrorCode: null as string | null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
};

export const mockTestPaymentSucceeded = {
  ...mockTestPaymentPending,
  status: PaymentStatus.SUCCEEDED,
  stripePaymentIntentId: 'pi_test_123',
  paidAt: new Date('2026-01-01T00:01:00Z')
};

export const mockTestPaymentFailed = {
  ...mockTestPaymentPending,
  status: PaymentStatus.FAILED,
  stripePaymentIntentId: 'pi_test_123',
  errorMessage: 'Your card was declined by your bank.',
  rawErrorCode: 'card_declined'
};

export const mockTestPaymentProcessing = {
  ...mockTestPaymentPending,
  status: PaymentStatus.PROCESSING,
  stripePaymentIntentId: 'pi_test_123'
};
