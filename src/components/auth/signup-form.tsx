"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import type { SignupPayload } from "@/types/auth.types";

export function SignupForm() {
  const [formData, setFormData] = useState<SignupPayload>({
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });

  // A single object + one change handler (keyed by `name`) instead of
  // five separate useState calls -- five fields that always submit
  // together belong in one piece of state, not five independent ones.
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO(backend-integration): call auth.service.ts#signup(formData)
    // once Route Handlers + Zod validation exist.
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Fullname"
        name="fullName"
        placeholder="Fullname"
        value={formData.fullName}
        onChange={handleChange}
        autoComplete="name"
        required
      />
      <FormField
        label="Email address"
        name="email"
        type="email"
        placeholder="email address"
        value={formData.email}
        onChange={handleChange}
        autoComplete="email"
        required
      />
      <FormField
        label="Mobile"
        name="mobile"
        type="tel"
        placeholder="mobile number"
        value={formData.mobile}
        onChange={handleChange}
        autoComplete="tel"
        required
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        autoComplete="new-password"
        required
      />
      <FormField
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        placeholder="Password"
        value={formData.confirmPassword}
        onChange={handleChange}
        autoComplete="new-password"
        required
      />

      <Button type="submit" className="mb-6 mt-2 w-full">
        SignUp
      </Button>

      <AuthFooterLink
        promptText="Already have an account!"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
