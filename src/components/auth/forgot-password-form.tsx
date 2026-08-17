"use client";

import { useState, type FormEvent } from "react";

import { AlertCircle, CheckCircle2 } from "lucide-react";
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
        <div className="mb-4 rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs sm:text-sm font-medium text-red-700 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs sm:text-sm font-medium text-emerald-700 flex items-start gap-2.5 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span className="flex-1 leading-snug">{message}</span>
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
