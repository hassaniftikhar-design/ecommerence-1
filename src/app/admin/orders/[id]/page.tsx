'use client';

import React, { use, useEffect, useState } from 'react';

import Link from 'next/link';

import { AlertCircle, ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';

import { OrderProductsTable } from '@/components/orders/order-products-table';
import { renderPaymentStatusBadge } from '@/components/orders/orders-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getOrderById, updateOrderStatus } from '@/services/order.service';
import { useToast } from '@/components/ui/toast';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { OrderDetail, OrderStatusType } from '@/types/order.types';

const ALLOWED_STATUS_OPTIONS: Record<
  OrderStatusType,
  { value: OrderStatusType; label: string }[]
> = {
  IN_PROGRESS: [
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DISPATCHED', label: 'Dispatched' },
    { value: 'REJECTED', label: 'Rejected' }
  ],
  DISPATCHED: [
    { value: 'DISPATCHED', label: 'Dispatched' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'REJECTED', label: 'Rejected' }
  ],
  DELIVERED: [{ value: 'DELIVERED', label: 'Delivered' }],
  REJECTED: [{ value: 'REJECTED', label: 'Rejected' }]
};

export default function AdminOrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { showSuccess, showError } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getOrderById(id);
        setOrder(data);
      } catch (err) {
        setError((err as Error).message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  const handleStatusChange = async (newStatus: OrderStatusType) => {
    if (!id || !order || newStatus === order.status) return;

    const previousStatus = order.status;
    // Optimistic update
    setOrder({ ...order, status: newStatus });

    try {
      setUpdating(true);
      await updateOrderStatus(id, newStatus);
      showSuccess(`Order status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      // Rollback on error
      setOrder({ ...order, status: previousStatus });
      showError((err as Error).message || 'Failed to update order status', 'Error');
    } finally {
      setUpdating(false);
    }
  };

  const isTerminalStatus = order?.status === 'DELIVERED' || order?.status === 'REJECTED';
  const isPaymentLocked = Boolean(
    order?.payment &&
      (order.payment.status === 'PENDING' ||
        order.payment.status === 'PROCESSING' ||
        order.payment.status === 'FAILED')
  );

  const currentOptions = order ? ALLOWED_STATUS_OPTIONS[order.status] || [] : [];
  const totalUnits = order?.products.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;

  return (
    <div className="space-y-6 pb-12">
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
              <Link href={ROUTES.adminOrders} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Orders
              </Link>
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-8">
          <Skeleton className="h-6 w-36" />
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-4 pt-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      ) : order ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-8">
          {/* Top Back Navigation Link */}
          <div>
            <Link
              href={ROUTES.adminOrders}
              className="inline-flex items-center gap-2 text-base sm:text-lg font-bold text-[#0B192C] hover:text-[#007BFF] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5 text-[#007BFF]" />
              Order Detail
            </Link>
          </div>

          {/* Top Metadata Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-x-4 gap-y-5 items-start">
            {/* 1. Date */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Date</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                {order.date}
              </p>
            </div>

            {/* 2. Order # */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Order #</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug truncate">
                {order.orderNumber}
              </p>
            </div>

            {/* 3. User */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">User</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug truncate">
                {order.user}
              </p>
            </div>

            {/* 4. Unit(s) */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Unit(s)</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                {String(totalUnits).padStart(2, '0')}
              </p>
            </div>

            {/* 5. Sub Total */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Sub Total</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                ${order.subTotal.toFixed(2)}
              </p>
            </div>

            {/* 6. Tax */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Tax</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                ${order.tax.toFixed(2)}
              </p>
            </div>

            {/* 7. Total */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Total</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                ${order.totalAmount.toFixed(2)}
              </p>
            </div>

            {/* 8. Payment Method */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Payment Method</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                {order.payment || order.paymentMethod === 'Card'
                  ? '💳 Card'
                  : '💵 Cash on Delivery'}
              </p>
            </div>

            {/* 9. Payment Status */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Payment Status</p>
              <div>
                {renderPaymentStatusBadge(
                  order.payment?.status,
                  order.payment ? 'Card' : order.paymentMethod
                )}
              </div>
            </div>

            {/* 10. Status Dropdown (Automatic change on select) */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-400">Status</p>
              <div className="relative inline-block">
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value as OrderStatusType)}
                  disabled={updating || isTerminalStatus || isPaymentLocked}
                  className={cn(
                    'appearance-none rounded-full font-bold text-[11px] sm:text-xs px-3 py-1 pr-6 border cursor-pointer transition-all outline-none',
                    order.status === 'IN_PROGRESS' && 'bg-blue-50 text-[#007BFF] border-blue-200 hover:bg-blue-100',
                    order.status === 'DISPATCHED' && 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                    order.status === 'DELIVERED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    order.status === 'REJECTED' && 'bg-rose-50 text-rose-700 border-rose-200',
                    (updating || isTerminalStatus || isPaymentLocked) && 'opacity-70 cursor-not-allowed'
                  )}
                  title={
                    isPaymentLocked
                      ? 'Status updates locked until customer payment succeeds'
                      : isTerminalStatus
                      ? 'Terminal status cannot be changed'
                      : 'Change order status'
                  }
                >
                  {currentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-normal">
                      {opt.label}
                    </option>
                  ))}
                </select>
                {updating ? (
                  <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[#007BFF] pointer-events-none" />
                ) : (
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-current opacity-70" />
                )}
              </div>
            </div>
          </div>

          {/* Product Information Section */}
          <div className="space-y-4 pt-2">
            <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">Product Information</h2>
            <OrderProductsTable products={order.products} role="ADMIN" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
