'use client';

import { useEffect, useState, useCallback } from 'react';

import Link from 'next/link';

import { AlertCircle, ShoppingBag } from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { OrdersTable } from '@/components/orders/orders-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getOrders } from '@/services/order.service';
import { ROUTES } from '@/constants/routes';
import type { OrderListItem } from '@/types/order.types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrders(page, PAGE_SIZE);
      setOrders(data.orders);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(currentPage);
  }, [currentPage, fetchOrders]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6 mx-auto px-2 sm:px-4 md:px-[56px] lg:px-[60px] pb-12">
      <BackHeading title="My Orders" href={ROUTES.home} />

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#007BFF]">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">No Orders Placed Yet</h2>
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
            You haven&apos;t placed any orders yet. Discover our catalog and start shopping today!
          </p>
          <div className="mt-6">
            <Button asChild className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold px-6 h-10 rounded-xl">
              <Link href={ROUTES.home}>Start Shopping</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <OrdersTable orders={orders} />

          {/* Pagination & Total Count Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs font-medium text-slate-500">
              {totalCount} Total {totalCount === 1 ? 'Order' : 'Orders'}
            </p>

            {totalPages > 1 && (
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 font-semibold text-blue-600 hover:bg-slate-50 disabled:opacity-40 rounded-md cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      'px-3 py-1.5 font-semibold rounded-md transition cursor-pointer',
                      currentPage === p
                        ? 'bg-blue-50 text-[#007BFF]'
                        : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 font-semibold text-blue-600 hover:bg-slate-50 disabled:opacity-40 rounded-md cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
