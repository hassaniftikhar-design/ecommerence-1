"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { RememberMe } from "@/components/auth/remember-me";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";
import type { LoginPayload } from "@/types/auth.types";
import { login } from "@/services/auth.service";

export function LoginForm() {
  const searchParams = useSearchParams();
  const oauthErrorParam = searchParams.get("error");
  const registeredParam = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(
    registeredParam === "true"
      ? "Account created successfully! Please log in with your credentials."
      : null
  );

  const [error, setError] = useState<string | null>(() => {
    if (oauthErrorParam === "CredentialsSignin") {
      return "Wrong username password, please enter correct credentials";
    }
    if (oauthErrorParam === "OAuthSignin" || oauthErrorParam === "Configuration") {
      return "Google OAuth Fails, Please try again!";
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  const emailError =
    emailTouched && !isValidEmail(email)
      ? "Enter a valid email address"
      : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);
    setError(null);
    setSuccessMessage(null);

    const payload: LoginPayload = { email, password, rememberMe };

    try {
      setLoading(true);
      await login(payload);
      const session = await getSession();

      if (session?.user?.role === "ADMIN") {
        window.location.href = ROUTES.adminProducts;
      } else {
        window.location.href = ROUTES.home;
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "CredentialsSignin" || msg.includes("CredentialsSignin")) {
        setError("Wrong Email & password, please enter correct credentials");
      } else {
        setError(msg || "Failed to log in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };


  // const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  //   event.preventDefault();

  //   console.log("🟢 LOGIN FORM SUBMITTED");

  //   setEmailTouched(true);
  //   setError(null);

  //   const payload: LoginPayload = {
  //     email,
  //     password,
  //     rememberMe,
  //   };

  //   console.log("📦 LOGIN PAYLOAD:", {
  //     email,
  //     rememberMe,
  //   });

  //   try {
  //     setLoading(true);

  //     console.log("🔵 BEFORE LOGIN");

  //     await login(payload);

  //     console.log("🟢 LOGIN SUCCESS");

  //     const session = await getSession();

  //     console.log("🔐 SESSION DEBUG:", {
  //       nextAuthExpires: session?.expires,
  //       rememberMe: session?.user?.rememberMe,
  //       customExpires: session?.user?.sessionExpiresAt,
  //       customExpiresDate: session?.user?.sessionExpiresAt
  //         ? new Date(session.user.sessionExpiresAt).toISOString()
  //         : null,
  //     });

  //     // if (session?.user?.role === "ADMIN") {
  //     //   window.location.href = ROUTES.adminProducts;
  //     // } else {
  //     //   window.location.href = ROUTES.home;
  //     // }
  //   } catch (err) {
  //     console.error("🔴 LOGIN ERROR:", err);
  //     setError((err as Error).message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };




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

      <Button type="submit" className="mb-4 w-full" disabled={loading}>
        {loading ? "Logging in..." : "Login"}
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
        <GoogleAuthButton label="Sign in with Google" />
      </div>

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
