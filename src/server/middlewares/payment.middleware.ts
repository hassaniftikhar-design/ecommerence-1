import { type ValidationResult } from './validation.middleware';

export interface ValidatedSavePaymentMethodInput {
  paymentMethodId: string;
  setAsDefault: boolean;
}

export function validateSavePaymentMethodInput(
  paymentMethodId: unknown,
  setAsDefault?: unknown
): ValidationResult<ValidatedSavePaymentMethodInput> {
  if (typeof paymentMethodId !== 'string' || !paymentMethodId.trim()) {
    return {
      success: false,
      status: 400,
      errors: ['paymentMethodId is required'],
      message: 'Missing or invalid paymentMethodId'
    };
  }

  return {
    success: true,
    data: {
      paymentMethodId: paymentMethodId.trim(),
      setAsDefault: Boolean(setAsDefault)
    }
  };
}

export function validatePaymentMethodIdInput(id: unknown): ValidationResult<string> {
  if (typeof id !== 'string' || !id.trim()) {
    return {
      success: false,
      status: 400,
      errors: ['id is required'],
      message: 'Payment method ID is required'
    };
  }

  return {
    success: true,
    data: id.trim()
  };
}
