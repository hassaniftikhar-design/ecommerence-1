'use client';

import { use, useEffect, useState } from 'react';

import Link from 'next/link';

import { AlertCircle, ArrowLeft } from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { OrderProductsTable } from '@/components/orders/order-products-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getOrderById } from '@/services/order.service';
import { ROUTES } from '@/constants/routes';
import type { OrderDetail } from '@/types/order.types';

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      if (!orderId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getOrderById(orderId);
        setOrder(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [orderId]);

  return (
    <div className="space-y-6 mx-auto px-2 sm:px-4 md:px-[56px] lg:px-[60px] pb-12">
      <BackHeading title="Order Detail" href={ROUTES.orders} />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xs space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-800">Failed to Load Order</h3>
            <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <div className="pt-2">
            <Button asChild variant="outline" className="border-red-200 hover:bg-red-100 text-red-700">
              <Link href={ROUTES.orders} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to My Orders
              </Link>
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>

          {/* Products Table Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <Skeleton className="h-6 w-48 mb-2" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : order ? (
        <div className="space-y-6">
          {/* Upper Detail Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            {/* Top Row: 6 Metadata Columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-4 sm:gap-y-0">
              {/* 1. DATE */}
              <div className="px-2 sm:px-4 first:pl-0 space-y-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">DATE</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {order.date}
                </p>
              </div>

              {/* 2. ORDER # */}
              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ORDER #</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                  {order.orderNumber}
                </p>
              </div>

              {/* 3. STATUS */}
              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">STATUS</p>
                <div className="pt-0.5">
                  {order.status === 'IN_PROGRESS' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#007BFF] border border-blue-200">
                      IN PROGRESS
                    </span>
                  ) : order.status === 'DISPATCHED' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-200">
                      DISPATCHED
                    </span>
                  ) : order.status === 'DELIVERED' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      DELIVERED
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      REJECTED
                    </span>
                  )}
                </div>
              </div>

              {/* 4. SUBTOTAL */}
              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SUBTOTAL</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  ${order.subTotal.toFixed(2)}
                </p>
              </div>

              {/* 5. TAX */}
              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TAX</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  ${order.tax.toFixed(2)}
                </p>
              </div>

              {/* 6. TOTAL */}
              <div className="px-2 sm:px-4 last:pr-0 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TOTAL</p>
                <p className="text-xs sm:text-sm font-bold text-[#007BFF] leading-snug">
                  ${order.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Bottom Sub-row: Delivery Address, Payment Method, Payment Status */}
            <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              {/* Left: Delivery Address */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  DELIVERY ADDRESS
                </span>
                <span className="text-xs font-medium text-slate-700">
                  {order.shippingAddress || '123 Main St, New York, 10001, USA'}
                </span>
              </div>

              {/* Right: Payment Method & Payment Status */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    PAYMENT METHOD:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {order.payment || order.paymentMethod === 'Card'
                      ? '💳 Card'
                      : '💵 Cash on Delivery'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    PAYMENT STATUS:
                  </span>
                  {order.payment?.status === 'FAILED' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200">
                      FAILED
                    </span>
                  ) : order.payment?.status === 'SUCCEEDED' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      PAID
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      {order.payment?.status || 'PENDING'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lower Product Information Table (remains same) */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#0B192C]">Product Information</h2>
            <OrderProductsTable products={order.products} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
