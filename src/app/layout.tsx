import type { ReactNode } from 'react';

import type { Metadata } from 'next';

import { inter } from '@/lib/fonts';
import { AppProviders } from '@/providers/app-providers';
import './globals.css';

// Root layout stays a Server Component (no "use client"). It renders
// <AppProviders> once, which is where client-only providers will hook
// in later without this file ever needing "use client" itself.
export const metadata: Metadata = {
  title: {
    default: 'ShopFastStore',
    template: '%s | ShopFastStore'
  },
  description:
    'ShopFastStore - A modern e-commerce storefront ',
  openGraph: {
    title: 'ShopFastStore',
    description:
      'ShopFastStore - A modern e-commerce storefront ',
    type: 'website'
  }
};

export default function RootLayout({
  children
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
