"use client";

// Client Component: this form owns controlled-input state (email,
// password, rememberMe) via useState and reacts to onChange/onSubmit,
// none of which can run on the server. Everything above it in the tree
// (the page, the layout, AuthCard) stays a Server Component.
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { RememberMe } from "@/components/auth/remember-me";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";
import type { LoginPayload } from "@/types/auth.types";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailError =
    emailTouched && !isValidEmail(email)
      ? "Enter a valid email address"
      : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);

    // TODO(backend-integration): call auth.service.ts#login(payload)
    // here once NextAuth's credentials flow exists. For now this is a
    // static placeholder handler, per the brief -- submit does nothing.
    const payload: LoginPayload = { email, password, rememberMe };
    void payload;
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

      <Button type="submit" className="mb-6 w-full">
        Login
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
