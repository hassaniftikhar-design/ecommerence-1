"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { isStrongPassword } from "@/utils/validation";

import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/services/auth.service";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

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
    setMessage(null);

    if (passwordError || confirmError) {
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ password, confirmPassword, token });
      setMessage("Your password has been reset successfully.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="mb-4 text-sm text-red-600 font-medium text-center">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 text-sm text-emerald-600 font-medium text-center">
          {message}
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
