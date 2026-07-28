import * as React from "react";

// Matches the sampled #007bff heading above every auth card. A single
// component instead of raw <h1> in each page so the four screens can
// never drift out of sync on size/weight/spacing.
export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mb-8 text-center text-4xl font-semibold text-primary">
      {children}
    </h1>
  );
}
