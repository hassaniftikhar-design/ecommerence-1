import { signIn, signOut } from "next-auth/react";
import type {
  ForgotPasswordPayload,
  LoginPayload,
  ResetPasswordPayload,
  SignupPayload,
} from "@/types/auth.types";

async function parseErrorResponse(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
    errors?: string[];
  } | null;

  if (data?.errors && data.errors.length > 0) {
    return data.errors.join(", ");
  }

  return data?.message || data?.error || response.statusText || "Request failed";
}

export async function login(payload: LoginPayload): Promise<void> {
  const result = await signIn("credentials", {
    redirect: false,
    email: payload.email,
    password: payload.password,
  });

  if (!result || result.error) {
    throw new Error(result?.error ?? "Invalid email or password");
  }
}

export async function logout(): Promise<void> {
  await signOut({ callbackUrl: "/login" });
}

export async function signup(payload: SignupPayload): Promise<void> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }
}

export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<void> {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }
}

export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<void> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }
}

export async function verifyResetToken(token: string): Promise<void> {
  const response = await fetch(
    `/api/auth/reset-password?token=${encodeURIComponent(token)}`
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }
}
