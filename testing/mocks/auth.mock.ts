import { Role } from "@prisma/client";
import type { AuthToken } from "@/lib/server-auth";
import type {
  LoginPayload,
  SignupPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,

} from "@/types/auth.types";

export const MOCK_USER_ID = "user-cuid-12345";
export const MOCK_ADMIN_ID = "admin-cuid-67890";
export const MOCK_GOOGLE_USER_ID = "google-user-cuid-99999";

export const mockRegularUser = {
  id: MOCK_USER_ID,
  name: "John Doe",
  email: "john@example.com",
  phone: "1234567890",
  password: "$2a$12$hashedPasswordExample12345678901234567890",
  role: Role.USER,
  emailVerified: new Date("2026-01-01T00:00:00Z"),
  isActive: true,
  resetToken: null as string | null,
  resetTokenExpires: null as Date | null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockAdminUser = {
  id: MOCK_ADMIN_ID,
  name: "Admin User",
  email: "admin@example.com",
  phone: "0987654321",
  password: "$2a$12$hashedAdminPasswordExample1234567890",
  role: Role.ADMIN,
  emailVerified: new Date("2026-01-01T00:00:00Z"),
  isActive: true,
  resetToken: null as string | null,
  resetTokenExpires: null as Date | null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockGoogleUser = {
  id: MOCK_GOOGLE_USER_ID,
  name: "Google User",
  email: "googleuser@example.com",
  phone: null as string | null,
  password: null as string | null,
  role: Role.USER,
  emailVerified: new Date("2026-01-01T00:00:00Z"),
  isActive: true,
  resetToken: null as string | null,
  resetTokenExpires: null as Date | null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockInactiveUser = {
  ...mockRegularUser,
  id: "inactive-user-id",
  email: "inactive@example.com",
  isActive: false,
};

export const mockUserWithValidResetToken = {
  ...mockRegularUser,
  resetToken: "valid-reset-token-hex-string-32-chars",
  resetTokenExpires: new Date(Date.now() + 1000 * 60 * 60), // 1 hour in future
};

export const mockUserWithExpiredResetToken = {
  ...mockRegularUser,
  resetToken: "expired-reset-token-hex-string",
  resetTokenExpires: new Date(Date.now() - 1000 * 60 * 60), // 1 hour in past
};

export const mockValidVerificationToken = {
  id: "vt-cuid-1",
  identifier: "john@example.com",
  token: "valid-verification-token-string",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours in future
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockExpiredVerificationToken = {
  id: "vt-cuid-2",
  identifier: "john@example.com",
  token: "expired-verification-token-string",
  expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour in past
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockGoogleAccount = {
  id: "account-cuid-google-1",
  userId: MOCK_GOOGLE_USER_ID,
  type: "oauth",
  provider: "google",
  providerAccountId: "google-oauth-account-id-123456",
  access_token: "mock-google-access-token",
  id_token: "mock-google-id-token",
  refresh_token: "mock-google-refresh-token",
  expires_at: 1800000000,
  token_type: "Bearer",
  scope: "openid email profile",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockAuthTokenUser: AuthToken = {
  id: MOCK_USER_ID,
  sub: MOCK_USER_ID,
  email: "john@example.com",
  role: Role.USER,
  rememberMe: true,
  sessionExpiresAt: Date.now() + 1000 * 60 * 60 * 24,
};

export const mockAuthTokenAdmin: AuthToken = {
  id: MOCK_ADMIN_ID,
  sub: MOCK_ADMIN_ID,
  email: "admin@example.com",
  role: Role.ADMIN,
  rememberMe: true,
  sessionExpiresAt: Date.now() + 1000 * 60 * 60 * 24,
};

export const mockLoginPayload: LoginPayload = {
  email: "john@example.com",
  password: "Password123!",
  rememberMe: true,
};

export const mockSignupPayload: SignupPayload = {
  fullName: "John Doe",
  email: "john@example.com",
  mobile: "1234567890",
  password: "Password123!",
  confirmPassword: "Password123!",
};

export const mockForgotPasswordPayload: ForgotPasswordPayload = {
  email: "john@example.com",
};

export const mockResetPasswordPayload: ResetPasswordPayload = {
  token: "valid-reset-token-hex-string-32-chars",
  password: "NewPassword123!",
  confirmPassword: "NewPassword123!",
};

export const mockChangePasswordPayload = {
  currentPassword: "OldPassword123!",
  newPassword: "NewPassword123!",
  confirmPassword: "NewPassword123!",
};
