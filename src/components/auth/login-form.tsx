"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { RememberMe } from "@/components/auth/remember-me";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";
import type { LoginPayload } from "@/types/auth.types";
import { login } from "@/services/auth.service";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError =
    emailTouched && !isValidEmail(email)
      ? "Enter a valid email address"
      : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);
    setError(null);

    const payload: LoginPayload = { email, password, rememberMe };

    try {
      setLoading(true);
      await login(payload);
      window.location.href = "/";
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

      <FormField
        label="Enter email address"
        name="email"
        type="email"
        placeholder="Please enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setEmailTouched(true)}
        error={emailError}
        autoComplete="email"
        required
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        placeholder="Please enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      <RememberMe checked={rememberMe} onCheckedChange={setRememberMe} />

      <Button type="submit" className="mb-6 w-full" disabled={loading}>
        {loading ? "Logging in..." : "Login"}
      </Button>

      <div className="space-y-2">
        <AuthFooterLink
          promptText="Forgot Password!"
          linkText="Reset"
          href={ROUTES.forgotPassword}
        />
        <AuthFooterLink
          promptText="I don't have an account!"
          linkText="SignUp"
          href={ROUTES.signup}
        />
      </div>
    </form>
  );
}
