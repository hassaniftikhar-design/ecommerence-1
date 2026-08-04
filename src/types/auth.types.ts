// Shared shapes for every auth form. Defining these now, even with no
// backend, means LoginForm/SignupForm and the future auth.service.ts /
// NextAuth callbacks all speak the same language later -- nothing about
// these types should need to change when Prisma/NextAuth are wired in.

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotEmailPayload {
  phone: string;
}

export interface ResetPasswordPayload {
  password: string;
  confirmPassword: string;
  // TODO(backend-integration): token will come from the reset-password
  // URL's search params (e.g. /reset-password?token=...) once
  // NextAuth + a real email flow exist.
  token?: string;
}

// Placeholder authenticated-user shape. Will likely be replaced by
// whatever shape NextAuth's `Session["user"]` ends up being.
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: "USER" | "ADMIN";
}
