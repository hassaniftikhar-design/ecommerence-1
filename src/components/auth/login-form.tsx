"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { FormField } from "@/components/forms/form-field";
import { RememberMe } from "@/components/auth/remember-me";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { ROUTES } from "@/constants/routes";
import { isValidEmail } from "@/utils/validation";
import type { LoginPayload } from "@/types/auth.types";
import { login } from "@/services/auth.service";
import { useToast } from "@/components/ui/toast";

export function LoginForm() {
  const searchParams = useSearchParams();
  const oauthErrorParam = searchParams.get("error");
  const registeredParam = searchParams.get("registered");
  const { showSuccess, showError } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (registeredParam === "true") {
      showSuccess("Account created successfully! Please log in with your credentials.", "Registration Successful");
    }
    if (oauthErrorParam === "CredentialsSignin") {
      showError("Wrong Email & password, please enter correct credentials", "Login Failed");
    } else if (oauthErrorParam === "OAuthSignin" || oauthErrorParam === "Configuration") {
      showError("Google OAuth Failed, Please try again!", "Google Login Failed");
    }
  }, [registeredParam, oauthErrorParam]);

  const emailError =
    emailTouched && !isValidEmail(email)
      ? "Enter a valid email address"
      : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);

    const payload: LoginPayload = { email, password, rememberMe };

    try {
      setLoading(true);
      await login(payload);
      const session = await getSession();

      showSuccess("Login successful!", "Welcome Back");

      if (session?.user?.role === "ADMIN") {
        window.location.href = ROUTES.adminProducts;
      } else {
        window.location.href = ROUTES.home;
      }
    } catch (err) {
      const msg = (err as Error).message;
      const displayMsg =
        msg === "CredentialsSignin" || msg.includes("CredentialsSignin")
          ? "Wrong Email & password, please enter correct credentials"
          : msg || "Failed to log in. Please try again.";
      showError(displayMsg, "Login Failed");
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
