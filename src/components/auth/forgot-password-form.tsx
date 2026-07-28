"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  // The Figma shows the error message rendered even before interaction
  // (it's a static design comp), but a real form should only show it
  // once the person has actually had a chance to type something --
  // so it's gated on `touched` rather than always-on.
  const error =
    touched && !isValidEmail(email) ? "Enter a valid email address" : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    // TODO(backend-integration): call
    // auth.service.ts#forgotPassword({ email }) to trigger a reset email.
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Enter email address"
        name="email"
        type="email"
        placeholder="Please enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched(true)}
        error={error}
        autoComplete="email"
        required
      />

      <Button type="submit" className="mb-6 mt-3 w-full">
        Forgot Password
      </Button>

      <AuthFooterLink
        promptText="No, I remember my password"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
