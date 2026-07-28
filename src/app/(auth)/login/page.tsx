import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthTitle } from "@/components/auth/auth-title";
import { LoginForm } from "@/components/auth/login-form";

// Server Component. It renders instantly with no client JS of its own
// -- only <LoginForm> (a leaf) opts into "use client" for its input
// state. Per-page metadata (title/description/OG) is exported here
// per the brief's requirement, and App Router merges it with the root
// layout's metadata automatically.
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
        <LoginForm />
      </AuthCard>
    </>
  );
}
