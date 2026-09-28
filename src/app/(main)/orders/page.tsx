import { Suspense } from 'react';

import type { Metadata } from 'next';

import { OrderComponent, OrderSkeleton } from '@/components/orders/order-component';

export const metadata: Metadata = {
  title: 'My Orders | ShopFastStore',
  description: 'View your order history and track order status'
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderComponent />
    </Suspense>
  );
}
