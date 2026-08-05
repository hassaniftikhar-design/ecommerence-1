"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { isStrongPassword } from "@/utils/validation";
import { resetPassword, verifyResetToken } from "@/services/auth.service";
import { ROUTES } from "@/constants";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<"verifying" | "valid" | "invalid">("verifying");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setTokenStatus("invalid");
      setTokenError("Missing or invalid password reset link.");
      return;
    }

    let isMounted = true;
    verifyResetToken(token)
      .then(() => {
        if (isMounted) {
          setTokenStatus("valid");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setTokenStatus("invalid");
          setTokenError(
            (err as Error).message ||
              "This password reset link has expired or has already been used."
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const passwordError =
    touched && password && !isStrongPassword(password)
      ? "Password must contain Capital, small letter, number and symbols"
      : undefined;

  const confirmError =
    touched && confirmPassword && confirmPassword !== password
      ? "Passwords do not match"
      : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(null);

    if (passwordError || confirmError) {
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ password, confirmPassword, token });
      setIsSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (tokenStatus === "verifying") {
    return (
      <div className="py-6 text-center text-sm font-medium text-slate-600">
        Verifying reset link...
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="text-center py-2">
        <div className="mb-4 p-4 rounded-md bg-red-50 text-red-700 text-sm font-medium border border-red-200">
          {tokenError || "This password reset link has expired or has already been used."}
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Please request a new link to reset your password.
        </p>
        <Button asChild className="w-full">
          <Link href={ROUTES.forgotPassword}>Go to Forgot Password</Link>
        </Button>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center py-2">
        <div className="mb-4 p-4 rounded-md bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200">
          Your password has been reset successfully.
        </div>
        <Button asChild className="w-full mt-2">
          <Link href={ROUTES.login}>Go to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="mb-4 text-sm text-red-600 font-medium text-center">
          {error}
        </div>
      )}

      <FormField
        label="Enter new password"
        name="password"
        type="password"
        placeholder="enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordError}
        autoComplete="new-password"
        required
      />
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={confirmError}
        autoComplete="new-password"
        required
      />

      <Button type="submit" className="mt-3 w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
