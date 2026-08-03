"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import type { SignupPayload } from "@/types/auth.types";
import { signup } from "@/services/auth.service";

export function SignupForm() {
  const [formData, setFormData] = useState<SignupPayload>({
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await signup(formData);
      window.location.href = "/login";
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

      <Button type="submit" className="mb-6 mt-2 w-full" disabled={loading}>
        {loading ? "Creating Account..." : "SignUp"}
      </Button>

      <AuthFooterLink
        promptText="Already have an account!"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
