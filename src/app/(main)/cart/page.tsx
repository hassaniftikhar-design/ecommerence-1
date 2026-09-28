import { Suspense } from 'react';

import type { Metadata } from 'next';

import { CartComponent } from '@/components/cart/cart-component';
import { CartSkeleton } from '@/components/cart/cart-skeleton';

export const metadata: Metadata = {
  title: 'Shopping Bag | ShopFastStore',
  description: 'View and manage items in your shopping bag'
};

export default function CartPage() {
  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartComponent />
    </Suspense>
  );
}
