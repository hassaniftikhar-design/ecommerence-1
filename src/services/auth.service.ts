import type {
  ForgotPasswordPayload,
  LoginPayload,
  ResetPasswordPayload,
  SignupPayload,
} from "@/types/auth.types";

// Every function here is intentionally unimplemented. This file exists
// so LoginForm/SignupForm/etc. can already `import { login } from
// "@/services/auth.service"` and call it from their placeholder submit
// handlers -- when Phase "Backend Integration" lands, only the body of
// these functions changes (to a fetch() against a Route Handler that
// calls NextAuth), never the calling components.

export async function login(_payload: LoginPayload): Promise<void> {
  // TODO(backend-integration): POST to /api/auth/login (NextAuth
  // credentials provider) once Route Handlers + Prisma are in place.
  throw new Error("Not implemented");
}

export async function signup(_payload: SignupPayload): Promise<void> {
  // TODO(backend-integration): POST to /api/auth/signup, validate with
  // a Zod schema shared between client and server, persist via Prisma.
  throw new Error("Not implemented");
}

export async function forgotPassword(
  _payload: ForgotPasswordPayload,
): Promise<void> {
  // TODO(backend-integration): POST to /api/auth/forgot-password to
  // generate + email a reset token.
  throw new Error("Not implemented");
}

export async function resetPassword(
  _payload: ResetPasswordPayload,
): Promise<void> {
  // TODO(backend-integration): POST to /api/auth/reset-password with
  // the token from the URL query string.
  throw new Error("Not implemented");
}
