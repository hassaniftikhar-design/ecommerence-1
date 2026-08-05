import type { Metadata } from "next";
import type { ReactNode } from "react";

import { inter } from "@/lib/fonts";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

// Root layout stays a Server Component (no "use client"). It renders
// <AppProviders> once, which is where client-only providers will hook
// in later without this file ever needing "use client" itself.
export const metadata: Metadata = {
  title: {
    default: "E-commerce",
    template: "%s | E-commerce",
  },
  description:
    "A modern e-commerce storefront built with Next.js App Router.",
  openGraph: {
    title: "E-commerce",
    description:
      "A modern e-commerce storefront built with Next.js App Router.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
