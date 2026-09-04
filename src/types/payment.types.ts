import type { PaymentStatus } from '@prisma/client';

export type { PaymentStatus };

export interface SavedPaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string | null;
  stripePaymentMethodId?: string | null;
  stripeCustomerId?: string | null;
  idempotencyKey?: string | null;
  attemptCount?: number;
  amount: number;
  currency: string;
  paidAt?: string | null;
  refundedAt?: string | null;
  errorMessage?: string | null;
  rawErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentIntentPayload {
  itemIds?: string[];
  expectedTotal?: number;
  savedPaymentMethodId?: string;
  saveCardForFuture?: boolean;
  idempotencyKey?: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  isPaid?: boolean;
}

export interface SetupIntentResponse {
  clientSecret: string;
}
