import {
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validators";
import { validateWithSchema, type ValidationResult } from "./validation.middleware";
import type { z } from "zod";

export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export function validateSignupInput(body: unknown): ValidationResult<SignupInput> {
  return validateWithSchema(signupSchema, body);
}

export function validateForgotPasswordInput(body: unknown): ValidationResult<ForgotPasswordInput> {
  return validateWithSchema(forgotPasswordSchema, body);
}

export function validateResetPasswordInput(body: unknown): ValidationResult<ResetPasswordInput> {
  return validateWithSchema(resetPasswordSchema, body);
}

export function validateChangePasswordInput(body: unknown): ValidationResult<ChangePasswordInput> {
  return validateWithSchema(changePasswordSchema, body);
}

export function validateResetTokenInput(token: unknown): ValidationResult<string> {
  if (typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Missing reset token",
    };
  }
  return {
    success: true,
    data: token.trim(),
  };
}

export function validateVerificationTokenInput(token: unknown): ValidationResult<string> {
  if (typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: "Verification token is required",
    };
  }
  return {
    success: true,
    data: token.trim(),
  };
}
