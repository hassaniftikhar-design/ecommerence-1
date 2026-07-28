import type { ReactNode } from "react";

// Shared by all four auth screens: centers a single child column on a
// full-height, light-gray page background -- exactly the Figma frame
// for Login/SignUp/Forgot Password/Reset Password. A route-group
// layout (the "(auth)" folder) is the right Next.js tool here because
// it applies shared UI to a set of routes without adding "/auth" to
// any of their URLs.
export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-[576px]">{children}</div>
    </div>
  );
}
