import { Suspense } from 'react';

import type { Metadata } from 'next';

import { CheckoutComponent, CheckoutSkeleton } from '@/components/checkout/checkout-component';

export const metadata: Metadata = {
  title: 'Checkout | ShopFastStore',
  description: 'Complete your order with secure delivery and payment options'
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutComponent />
    </Suspense>
  );
}
