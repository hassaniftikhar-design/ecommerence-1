"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { CartProvider } from "@/providers/cart-provider";

import { SessionExpiryHandler } from "@/components/auth/session-expiry-handler";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <SessionExpiryHandler />
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CartProvider>{children}</CartProvider>
        </ToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

