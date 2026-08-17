"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      setLoading(true);
      await signup(formData);
      setSuccessMessage("Account created successfully! Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login?registered=true";
      }, 1500);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "CredentialsSignin" || msg.includes("CredentialsSignin")) {
        setError("Wrong username password, please enter correct credentials");
      } else {
        setError(msg || "Failed to create account. Please check your details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="mb-4 rounded-md bg-[#f8d7da] border border-[#f5c6cb] px-4 py-3 text-sm text-[#721c24] flex items-center justify-between gap-3 shadow-2xs">
          <span className="flex-1 font-medium">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#721c24] hover:opacity-75 transition-opacity cursor-pointer shrink-0 font-bold p-0.5 text-base leading-none"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-md bg-[#d4edda] border border-[#c3e6cb] px-4 py-3 text-sm text-[#155724] flex items-center justify-between gap-3 shadow-2xs">
          <span className="flex-1 font-medium">{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#155724] hover:opacity-75 transition-opacity cursor-pointer shrink-0 font-bold p-0.5 text-base leading-none"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
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

      <Button type="submit" className="mb-4 mt-2 w-full" disabled={loading}>
        {loading ? "Creating Account..." : "SignUp"}
      </Button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface-card px-2 text-slate-500 font-medium">Or continue with</span>
        </div>
      </div>

      <div className="mb-6">
        <GoogleAuthButton label="Sign up with Google" />
      </div>

      <AuthFooterLink
        promptText="Already have an account!"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
