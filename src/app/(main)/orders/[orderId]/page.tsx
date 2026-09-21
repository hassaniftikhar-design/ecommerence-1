'use client';

import { use, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AlertCircle, ArrowLeft, Clock, RotateCcw, XCircle } from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { OrderProductsTable } from '@/components/orders/order-products-table';
import { renderStatusBadge, renderPaymentStatusBadge } from '@/components/orders/orders-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getOrderById, retryOrderPayment } from '@/services/order.service';
import { getOrderPaymentIntent } from '@/services/payment.service';
import { PriceChangedModal } from '@/components/checkout/price-changed-modal';
import { OutOfStockModal } from '@/components/cart/out-of-stock-modal';
import { ROUTES } from '@/constants/routes';
import { formatPaymentErrorMessage } from '@/lib/stripe/errors';
import type { OrderDetail } from '@/types/order.types';
import { cn } from '@/lib/utils';

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChangedAlert, setPriceChangedAlert] = useState<{
    isOpen: boolean;
    oldTotal?: number;
    newTotal: number;
    changedItems?: { name: string; oldPrice?: number; newPrice?: number; price?: number }[];
  } | null>(null);
  const [outOfStockMessage, setOutOfStockMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      if (!orderId) return;
      try {
        setLoading(true);
        setError(null);
        let data = await getOrderById(orderId);

        // If payment is PENDING on card order, check Stripe status once to reconcile any webhook lag
        if (data?.payment?.status === 'PENDING') {
          try {
            const intentRes = await getOrderPaymentIntent(orderId);
            if (intentRes.isPaid) {
              data = await getOrderById(orderId);
            }
          } catch {
            // Ignore background sync errors
          }
        }

        setOrder(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [orderId]);

  const handleRetryPayment = async () => {
    if (!order) return;
    try {
      setRetrying(true);
      setError(null);

      // 1. In-place backend validation
      const intentRes = await getOrderPaymentIntent(order.id);

      if (intentRes.isPaid) {
        const refreshed = await getOrderById(order.id);
        setOrder(refreshed);
        return;
      }

      router.push(`${ROUTES.checkout}?orderId=${order.id}`);
    } catch (err: unknown) {
      const errorObj = err as {
        errors?: string[];
        data?: {
          newTotal?: number;
          oldTotal?: number;
          currentPrice?: number;
          oldPrice?: number;
          productId?: string;
          changedItems?: { name: string; oldPrice?: number; newPrice?: number; price?: number }[];
        };
        message?: string;
      };

      if (errorObj?.errors?.includes?.('PRICE_CHANGED')) {
        const newTotal = errorObj.data?.newTotal || errorObj.data?.currentPrice || Number(order.totalAmount);
        const oldTotal = errorObj.data?.oldTotal || Number(order.totalAmount);
        let changedItems = errorObj.data?.changedItems;

        if (!changedItems || changedItems.length === 0) {
          if (errorObj.data?.oldPrice && errorObj.data?.currentPrice) {
            const matchingProduct = order.products.find(
              (p) => p.productId === errorObj.data?.productId || p.id === errorObj.data?.productId
            );
            changedItems = [{
              name: matchingProduct?.title || 'Product in your order',
              oldPrice: errorObj.data.oldPrice,
              newPrice: errorObj.data.currentPrice
            }];
          }
        }

        setPriceChangedAlert({
          isOpen: true,
          oldTotal,
          newTotal,
          changedItems
        });
        return;
      }

      if (
        errorObj?.errors?.includes?.('OUT_OF_STOCK') ||
        errorObj?.errors?.includes?.('VARIANT_DELETED') ||
        errorObj?.errors?.includes?.('INACTIVE_PRODUCT') ||
        errorObj?.message?.toLowerCase()?.includes('out of stock') ||
        errorObj?.message?.toLowerCase()?.includes('does not exist') ||
        errorObj?.message?.toLowerCase()?.includes('inactive')
      ) {
        setOutOfStockMessage(errorObj.message || 'An item in this order is no longer available. Please check product availability.');
        return;
      }

      console.error('Failed to prepare retry payment:', err);
      router.push(`${ROUTES.checkout}?orderId=${order.id}`);
    } finally {
      setRetrying(false);
    }
  };

  const isCodOrder =
    order?.paymentMethod === 'Cash on Delivery' ||
    order?.paymentMethod === 'COD' ||
    !order?.payment;
  const isCardOrder = !isCodOrder && Boolean(order?.payment);
  const isPaymentFailed = Boolean(isCardOrder && order?.payment?.status === 'FAILED');
  const isPaymentPendingCard = Boolean(
    isCardOrder &&
    order?.payment?.status === 'PENDING' &&
    order?.status === 'IN_PROGRESS'
  );

  return (
    <div className="space-y-6 mx-auto px-2 sm:px-4 md:px-[56px] lg:px-[60px] pb-12">
      <BackHeading title="Order Detail" href={ROUTES.orders} />

      {/* Payment Action Banner (Failed Payment or Unpaid Pending Card Order) */}
      {order && (isPaymentFailed || isPaymentPendingCard) && (
        <div
          className={cn(
            'rounded-2xl border p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4',
            isPaymentFailed
              ? 'border-red-200 bg-red-50/80'
              : 'border-amber-200 bg-amber-50/80'
          )}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4',
                isPaymentFailed
                  ? 'bg-red-100 text-red-600 ring-red-50'
                  : 'bg-amber-100 text-amber-600 ring-amber-50'
              )}
            >
              {isPaymentFailed ? <XCircle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    'text-base font-bold',
                    isPaymentFailed ? 'text-red-900' : 'text-amber-900'
                  )}
                >
                  {isPaymentFailed ? 'Payment Failed' : 'Payment Required'}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    isPaymentFailed
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                  )}
                >
                  Action Required
                </span>
              </div>
              <p
                className={cn(
                  'text-xs sm:text-sm max-w-xl',
                  isPaymentFailed ? 'text-red-700/90' : 'text-amber-800/90'
                )}
              >
                {isPaymentFailed
                  ? formatPaymentErrorMessage(order.payment?.errorMessage)
                  : 'Payment has not been completed for this card order. Please pay now to finalize your purchase.'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleRetryPayment}
            disabled={retrying}
            className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 shrink-0 self-start sm:self-center transition-all cursor-pointer"
          >
            <RotateCcw className={cn('h-4 w-4', retrying && 'animate-spin')} />
            {retrying
              ? 'Loading Checkout...'
              : isPaymentFailed
                ? 'Retry Payment'
                : 'Pay Now'}
          </Button>
        </div>
      )}

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-4 sm:gap-y-0">
              <div className="px-2 sm:px-4 first:pl-0 space-y-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">DATE</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {order.date}
                </p>
              </div>

              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ORDER #</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                  {order.orderNumber}
                </p>
              </div>

              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">STATUS</p>
                <div className="pt-0.5">
                  {renderStatusBadge(order.status)}
                </div>
              </div>

              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SUBTOTAL</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  ${order.subTotal.toFixed(2)}
                </p>
              </div>

              <div className="px-2 sm:px-4 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TAX</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  ${order.tax.toFixed(2)}
                </p>
              </div>

              <div className="px-2 sm:px-4 last:pr-0 space-y-1 pt-3 sm:pt-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TOTAL</p>
                <p className="text-xs sm:text-sm font-bold text-[#007BFF] leading-snug">
                  ${order.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  DELIVERY ADDRESS
                </span>
                <span className="text-xs font-medium text-slate-700">
                  {order.shippingAddress || '123 Main St, New York, 10001, USA'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    PAYMENT METHOD:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {isCardOrder ? '💳 Card' : '💵 Cash on Delivery'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    PAYMENT STATUS:
                  </span>
                  <div>
                    {renderPaymentStatusBadge(
                      order.payment?.status,
                      isCardOrder ? 'Card' : 'Cash on Delivery'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#0B192C]">Product Information</h2>
            <OrderProductsTable products={order.products} role="USER" />
          </div>
        </div>
      ) : null}

      {/* Price Changed Modal */}
      {priceChangedAlert?.isOpen && (
        <PriceChangedModal
          isOpen={true}
          oldTotal={priceChangedAlert.oldTotal}
          newTotal={priceChangedAlert.newTotal}
          changedItems={priceChangedAlert.changedItems}
          cancelText="Cancel"
          acceptText="Accept and Proceed"
          onAccept={async () => {
            const targetId = order?.id || orderId;
            setPriceChangedAlert(null);
            if (targetId) {
              try {
                await getOrderPaymentIntent(targetId, undefined, true);
              } catch (err) {
                console.warn('Failed to update order price before checkout:', err);
              }
            }
            router.push(`${ROUTES.checkout}?orderId=${targetId}`);
          }}
          onCancel={() => {
            setPriceChangedAlert(null);
          }}
        />
      )}

      {/* Out of Stock Modal */}
      {outOfStockMessage && (
        <OutOfStockModal
          isOpen={true}
          message={outOfStockMessage}
          onClose={() => {
            setOutOfStockMessage(null);
          }}
        />
      )}
    </div>
  );
}

