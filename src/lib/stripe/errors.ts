/**
 * Friendly decline code mapping table for Stripe payments.
 * Maps raw technical Stripe error/decline codes to safe, customer-friendly messages.
 */
export const STRIPE_DECLINE_CODE_MAP: Record<string, string> = {
  insufficient_funds: 'Your card has insufficient funds. Please try another payment method or contact your bank.',
  card_declined: 'Your card was declined by your bank. Please use a different card or contact your bank for details.',
  expired_card: 'Your card has expired. Please check the expiration date or use another card.',
  incorrect_cvc: 'The security code (CVC) you entered is incorrect. Please check the code on the back of your card and try again.',
  invalid_cvc: 'The security code (CVC) is invalid. Please check your card and try again.',
  incorrect_number: 'The card number you entered is incorrect. Please check the number and try again.',
  invalid_number: 'The card number is invalid. Please check the number and try again.',
  invalid_expiry_month: 'The card\'s expiration month is invalid. Please check and try again.',
  invalid_expiry_year: 'The card\'s expiration year is invalid. Please check and try again.',
  lost_card: 'This card was reported lost. Please use a different payment method.',
  stolen_card: 'This card was reported stolen. Please use a different payment method.',
  processing_error: 'A temporary processing error occurred with your payment. Please wait a moment and try again.',
  card_velocity_exceeded: 'Too many recent attempts with this card. Please wait a few minutes before trying again or use a different card.',
  do_not_honor: 'Your bank declined the transaction. Please contact your card issuer or try another card.',
  do_not_try_again: 'Your bank has declined this card. Please use a different payment method.',
  generic_decline: 'Your payment could not be processed. Please check your payment details or try a different card.',
  pickup_card: 'This card cannot be used. Please contact your card issuer or try another card.',
  restricted_card: 'Your card has restrictions preventing this purchase. Please contact your card issuer.',
  revocation_of_all_authorizations: 'This card has been revoked by the issuer. Please use another card.',
  security_violation: 'A security issue was detected by your bank. Please contact your card issuer.',
  service_not_allowed: 'This card is not supported for this transaction type. Please try a different card.',
  stop_payment_order: 'A stop payment has been placed on this card. Please use a different payment method.',
  testmode_decline: 'This test card was deliberately declined.',
  transaction_not_allowed: 'Your bank does not allow this type of transaction on this card. Please contact your bank.',
  withdrawal_count_limit_exceeded: 'Your card\'s transaction limit has been reached. Please contact your bank or use a different card.',
  call_issuer: 'Your card was declined. Please call your card issuer for authorization.',
  card_not_supported: 'This card type is not supported. Please use a Visa, Mastercard, or American Express card.',
  currency_not_supported: 'This card does not support the requested currency. Please try another card.',
  duplicate_transaction: 'A duplicate payment was detected. Please check your orders before trying again.',
  fraudulent: 'Your payment was declined by our fraud prevention system. Please try a different card.',
  issuer_not_available: 'The card issuer could not be reached. Please try again in a few moments.',
  try_again_later: 'The payment server is temporarily unavailable. Please try again shortly.'
};

export const GENERIC_PAYMENT_ERROR_MESSAGE =
  'Your payment could not be completed. Please check your payment details or try another card.';

/**
 * Resolves a friendly, non-technical error message from any Stripe error or decline code.
 */
export function getFriendlyPaymentErrorMessage(
  errorOrCode?: unknown
): {
  friendlyMessage: string;
  rawErrorCode: string;
  rawErrorMessage: string;
} {
  if (!errorOrCode) {
    return {
      friendlyMessage: GENERIC_PAYMENT_ERROR_MESSAGE,
      rawErrorCode: 'unknown',
      rawErrorMessage: 'No error details provided'
    };
  }

  if (typeof errorOrCode === 'string') {
    const normalizedCode = errorOrCode.toLowerCase().trim();
    const friendlyMessage = STRIPE_DECLINE_CODE_MAP[normalizedCode] || errorOrCode;
    return {
      friendlyMessage,
      rawErrorCode: normalizedCode,
      rawErrorMessage: normalizedCode
    };
  }

  const errObj = errorOrCode as { code?: string; decline_code?: string; message?: string };
  const rawErrorCode = (errObj.decline_code || errObj.code || 'unknown').toLowerCase().trim();
  const rawErrorMessage = errObj.message || rawErrorCode;
  const friendlyMessage =
    STRIPE_DECLINE_CODE_MAP[rawErrorCode] ||
    (errObj.message && !errObj.message.toLowerCase().includes('failed to fetch')
      ? errObj.message
      : GENERIC_PAYMENT_ERROR_MESSAGE);

  return {
    friendlyMessage,
    rawErrorCode,
    rawErrorMessage
  };
}

/**
 * Server-side logger for recording raw technical Stripe errors safely.
 */
export function logStripeError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.error(`[Stripe Error] [${timestamp}] Context: ${context}`, {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    metadata
  });
}
