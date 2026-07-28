"use client";

import * as React from "react";

// Currently a no-op passthrough. It exists now so the root layout
// already renders <AppProviders> once, instead of every future
// provider (NextAuth's <SessionProvider>, a react-query
// QueryClientProvider, a ThemeProvider, etc.) requiring a change to
// layout.tsx itself -- they'll just be added inside this one component.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
