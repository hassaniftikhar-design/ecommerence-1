import { z } from 'zod';

import { validateWithSchema, type ValidationResult } from './validation.middleware';

export const sendFacebookOtpSchema = z.object({
  pendingToken: z.string().min(1, 'Pending token is required'),
  email: z.string().trim().email('Invalid email address')
});

export const verifyFacebookOtpSchema = z.object({
  pendingToken: z.string().min(1, 'Pending token is required'),
  email: z.string().trim().email('Invalid email address'),
  otp: z.string().trim().min(6, 'Verification code must be 6 digits').max(6, 'Verification code must be 6 digits')
});

export type SendFacebookOtpInput = z.infer<typeof sendFacebookOtpSchema>;
export type VerifyFacebookOtpInput = z.infer<typeof verifyFacebookOtpSchema>;

export function validateSendFacebookOtpInput(body: unknown): ValidationResult<SendFacebookOtpInput> {
  return validateWithSchema(sendFacebookOtpSchema, body);
}

export function validateVerifyFacebookOtpInput(body: unknown): ValidationResult<VerifyFacebookOtpInput> {
  return validateWithSchema(verifyFacebookOtpSchema, body);
}
