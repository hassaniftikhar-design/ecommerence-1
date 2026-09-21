import type {
  SavedPaymentMethod,
  CreatePaymentIntentPayload,
  CreatePaymentIntentResponse,
  SetupIntentResponse
} from '@/types/payment.types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export async function createCheckoutIntent(
  payload: CreatePaymentIntentPayload
): Promise<CreatePaymentIntentResponse> {
  const response = await fetch('/api/checkout/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json: ApiResponse<CreatePaymentIntentResponse> = await response.json();

  if (!response.ok || !json.success) {
    const error = Object.assign(new Error(json.message || 'Failed to initialize checkout'), {
      status: response.status,
      data: json.data,
      errors: json.errors
    });
    throw error;
  }

  return json.data;
}

export async function getOrderPaymentIntent(
  orderId: string,
  savedPaymentMethodId?: string,
  acceptPriceUpdate?: boolean
): Promise<CreatePaymentIntentResponse> {
  const response = await fetch(`/api/orders/${orderId}/payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ savedPaymentMethodId, acceptPriceUpdate })
  });

  const json: ApiResponse<CreatePaymentIntentResponse> = await response.json();

  if (!response.ok || !json.success) {
    const error = Object.assign(new Error(json.message || 'Failed to retrieve payment intent'), {
      status: response.status,
      data: json.data,
      errors: json.errors
    });
    throw error;
  }

  return json.data;
}

export async function getSavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const response = await fetch('/api/payment-methods', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const json: ApiResponse<{ paymentMethods: SavedPaymentMethod[] }> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || 'Failed to load payment methods');
  }

  return json.data.paymentMethods || [];
}

export async function getSetupIntentSecret(): Promise<string> {
  const response = await fetch('/api/payment-methods/setup-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const json: ApiResponse<SetupIntentResponse> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || 'Failed to initialize card setup');
  }

  return json.data.clientSecret;
}

export async function savePaymentMethod(
  paymentMethodId: string,
  setAsDefault?: boolean
): Promise<SavedPaymentMethod> {
  const response = await fetch('/api/payment-methods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentMethodId, setAsDefault })
  });

  const json: ApiResponse<{ paymentMethod: SavedPaymentMethod }> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || 'Failed to save payment method');
  }

  return json.data.paymentMethod;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const response = await fetch(`/api/payment-methods/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });

  const json: ApiResponse<void> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || 'Failed to delete payment method');
  }
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const response = await fetch(`/api/payment-methods/${id}/default`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  });

  const json: ApiResponse<void> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.message || 'Failed to update default payment method');
  }
}
