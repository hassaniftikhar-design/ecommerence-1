"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { isStrongPassword } from "@/utils/validation";
import { resetPassword, verifyResetToken } from "@/services/auth.service";
import { ROUTES } from "@/constants";
import { useToast } from "@/components/ui/toast";

export function ResetPasswordForm() {
  const { showError } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [touched, setTouched] = useState<{ password?: boolean; confirmPassword?: boolean }>({});
  const [tokenStatus, setTokenStatus] = useState<"verifying" | "valid" | "invalid">("verifying");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
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

  const validateField = (
    name: "password" | "confirmPassword",
    val: string,
    pwd = password
  ): string | undefined => {
    if (name === "password") {
      if (!val) return "Password is required";
      if (val.length < 8) return "Password must be at least 8 characters";
      if (!isStrongPassword(val)) {
        return "Password must contain Capital, small letter, number and symbols";
      }
      return undefined;
    }
    if (name === "confirmPassword") {
      if (!val) return "Confirm password is required";
      if (val !== pwd) return "Passwords must match";
      return undefined;
    }
    return undefined;
  };

  const handleBlur = (name: "password" | "confirmPassword") => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const errorMsg = validateField(name, name === "password" ? password : confirmPassword);
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ password: true, confirmPassword: true });

    const pwdErr = validateField("password", password);
    const confirmErr = validateField("confirmPassword", confirmPassword, password);

    if (pwdErr || confirmErr) {
      setErrors({ password: pwdErr, confirmPassword: confirmErr });
      return;
    }

    setErrors({});

    try {
      setLoading(true);
      await resetPassword({ password, confirmPassword, token });
      setIsSuccess(true);
    } catch (err) {
      const errMsg = (err as Error).message || "Failed to reset password. Please try again.";
      showError(errMsg, "Password Reset Failed");
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
      <FormField
        label="Enter new password"
        name="password"
        type="password"
        placeholder="enter password"
        value={password}
        onChange={(e) => {
          const val = e.target.value;
          setPassword(val);
          if (touched.password) {
            setErrors((prev) => ({ ...prev, password: validateField("password", val) }));
          }
          if (touched.confirmPassword) {
            setErrors((prev) => ({
              ...prev,
              confirmPassword: validateField("confirmPassword", confirmPassword, val),
            }));
          }
        }}
        onBlur={() => handleBlur("password")}
        error={errors.password}
        autoComplete="new-password"
        required
      />
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => {
          const val = e.target.value;
          setConfirmPassword(val);
          if (touched.confirmPassword) {
            setErrors((prev) => ({
              ...prev,
              confirmPassword: validateField("confirmPassword", val, password),
            }));
          }
        }}
        onBlur={() => handleBlur("confirmPassword")}
        error={errors.confirmPassword}
        autoComplete="new-password"
        required
      />

      <Button type="submit" className="mt-3 w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
