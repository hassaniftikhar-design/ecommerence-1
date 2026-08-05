import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthTitle } from "@/components/auth/auth-title";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to your E-commerce account.",
  openGraph: { title: "Login | E-commerce" },
};

export default function LoginPage() {
  return (
    <>
      <AuthTitle>Login</AuthTitle>
      <AuthCard>
        <Suspense fallback={<div className="p-4 text-center text-sm text-slate-500">Loading form...</div>}>
          <LoginForm />
        </Suspense>
      </AuthCard>
    </>
  );
}
