"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";

import { forgotPassword } from "@/services/auth.service";
import { useToast } from "@/components/ui/toast";

export function ForgotPasswordForm() {
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const validateEmail = (val: string): string | undefined => {
    if (!val.trim()) return "Email is required";
    if (!isValidEmail(val)) return "Enter a valid email address";
    return undefined;
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validateEmail(email));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }

    setError(undefined);

    try {
      setLoading(true);
      await forgotPassword({ email });
      setEmail("");
      setTouched(false);
      setError(undefined);
      showSuccess(
        "Password reset instructions have been sent to your email.",
        "Email Sent"
      );
    } catch (err) {
      const errMsg =
        (err as Error).message || "This email does not exist in our Store.";
      showError(errMsg, "Password Reset Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Enter email address"
        name="email"
        type="email"
        placeholder="Please enter your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (touched) {
            setError(validateEmail(e.target.value));
          }
        }}
        onBlur={handleBlur}
        error={error}
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
