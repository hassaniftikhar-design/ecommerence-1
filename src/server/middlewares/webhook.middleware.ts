import { type ValidationResult } from './validation.middleware';

export interface ValidatedWebhookHeaderInput {
  signature: string;
  webhookSecret: string;
}

export function validateStripeWebhookInput(
  signature: string | null,
  webhookSecret?: string
): ValidationResult<ValidatedWebhookHeaderInput> {
  if (!signature) {
    return {
      success: false,
      status: 400,
      errors: ['Missing stripe-signature header'],
      message: 'Missing stripe-signature header'
    };
  }

  if (!webhookSecret) {
    return {
      success: false,
      status: 500,
      errors: ['Webhook secret not configured'],
      message: 'Webhook secret not configured'
    };
  }

  return {
    success: true,
    data: {
      signature,
      webhookSecret
    }
  };
}
