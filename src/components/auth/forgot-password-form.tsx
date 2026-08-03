"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";

import { forgotPassword } from "@/services/auth.service";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fieldError =
    touched && !isValidEmail(email) ? "Enter a valid email address" : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    setMessage(null);

    if (fieldError) {
      return;
    }

    try {
      setLoading(true);
      await forgotPassword({ email });
      setMessage("If an account exists, reset instructions have been sent.");
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
        label="Enter email address"
        name="email"
        type="email"
        placeholder="Please enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched(true)}
        error={fieldError}
        autoComplete="email"
        required
      />

      <Button type="submit" className="mb-6 mt-3 w-full" disabled={loading}>
        {loading ? "Sending..." : "Forgot Password"}
      </Button>

      <AuthFooterLink
        promptText="No, I remember my password"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
