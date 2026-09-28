'use client';

import React, { use, useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  ShoppingBag,
  Package
} from 'lucide-react';

import type { PaymentIntent } from '@stripe/stripe-js';

import { getStripe } from '@/lib/stripe/stripe-client';
import { getFriendlyPaymentErrorMessage } from '@/lib/stripe/errors';
import { getOrderById, retryOrderPayment } from '@/services/order.service';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrderDetail } from '@/types/order.types';
import { cn } from '@/lib/utils';

export default function PaymentStatusPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    'succeeded' | 'processing' | 'failed' | 'requires_payment_method' | 'unknown'
  >('unknown');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    async function checkPaymentStatus() {
      try {
        setLoading(true);

        const clientSecret = searchParams.get('payment_intent_client_secret');
        const redirectStatus = searchParams.get('redirect_status');

        // 1. Fetch Order Details for UI Display
        let orderDetails: OrderDetail | null = null;
        try {
          orderDetails = await getOrderById(orderId);
          setOrder(orderDetails);
        } catch (orderErr) {
          console.warn('Could not fetch order details:', orderErr);
        }

        // 2. Retrieve PaymentIntent status client-side via Stripe.js for instant UX feedback
        const stripe = await getStripe();

        if (stripe && clientSecret) {
          const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);

          if (error) {
            const { friendlyMessage } = getFriendlyPaymentErrorMessage(error);
            setPaymentStatus('failed');
            setErrorMessage(friendlyMessage);
          } else if (paymentIntent) {
            handlePaymentIntentStatus(paymentIntent);
          }
        } else if (redirectStatus === 'succeeded') {
          setPaymentStatus('succeeded');
        } else if (redirectStatus === 'failed') {
          setPaymentStatus('failed');
          setErrorMessage('Payment was unsuccessful. Please try again.');
        } else {
          setPaymentStatus('succeeded');
        }
      } catch (err: unknown) {
        const { friendlyMessage } = getFriendlyPaymentErrorMessage(err);
        setPaymentStatus('failed');
        setErrorMessage(friendlyMessage);
      } finally {
        setLoading(false);
      }
    }

    function handlePaymentIntentStatus(intent: PaymentIntent) {
      switch (intent.status) {
        case 'succeeded':
          setPaymentStatus('succeeded');
          break;
        case 'processing':
          setPaymentStatus('processing');
          break;
        case 'requires_payment_method':
          setPaymentStatus('requires_payment_method');
          if (intent.last_payment_error) {
            const { friendlyMessage } = getFriendlyPaymentErrorMessage(
              intent.last_payment_error
            );
            setErrorMessage(friendlyMessage);
          } else {
            setErrorMessage('Your payment was declined. Please try another card.');
          }
          break;
        case 'canceled':
          setPaymentStatus('failed');
          setErrorMessage('Payment was canceled. You have not been charged.');
          break;
        default:
          setPaymentStatus('unknown');
          setErrorMessage('Payment status could not be confirmed. Please check your order history.');
          break;
      }
    }

    checkPaymentStatus();
  }, [orderId, searchParams]);

  useEffect(() => {
    if (paymentStatus === 'succeeded') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cart-updated'));

        window.history.pushState(null, '', window.location.href);
        const handlePopState = () => {
          router.replace(ROUTES.home);
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
          window.removeEventListener('popstate', handlePopState);
        };
      }
    }
  }, [paymentStatus, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-6">
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto h-8 w-64 rounded-lg" />
        <Skeleton className="mx-auto h-16 w-full rounded-xl" />
        <Skeleton className="mx-auto h-11 w-48 rounded-xl" />
      </div>
    );
  }

  // SUCCESS VIEW
  if (paymentStatus === 'succeeded') {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Payment Successful!
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Thank you for your order. We have received your payment and your order is now being processed.
            </p>
          </div>

          {order && (
            <div className="rounded-2xl bg-slate-50 p-5 text-left border border-slate-100 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Order Number:</span>
                <span className="font-bold text-slate-900">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Total Amount Paid:</span>
                <span className="font-bold text-[#007BFF] text-sm">${order.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Order Date:</span>
                <span className="font-medium text-slate-800">{order.date}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Items:</span>
                <span className="font-medium text-slate-800">{order.products.length} product(s)</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
            <Button
              onClick={() => router.push(ROUTES.orderDetail(orderId))}
              className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2"
            >
              <Package className="h-4 w-4" /> View Order Details
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push(ROUTES.home)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold h-11 px-6 rounded-xl flex items-center justify-center gap-2"
            >
              <ShoppingBag className="h-4 w-4" /> Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // PROCESSING VIEW
  if (paymentStatus === 'processing') {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] ring-8 ring-blue-50/50">
            <Clock className="h-10 w-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Payment Processing
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your payment is currently being processed by your bank. We will notify you as soon as the transaction is confirmed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
            <Button
              onClick={() => router.push(ROUTES.orderDetail(orderId))}
              className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 px-6 rounded-xl shadow-sm"
            >
              View Order Status
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // FAILURE / DECLINE VIEW
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
          <XCircle className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Payment Failed
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            We were unable to complete your payment for this order.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-left text-xs font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
          {order?.status !== 'REJECTED' && (
            <Button
              onClick={async () => {
                try {
                  setRetrying(true);
                  if (order) {
                    await retryOrderPayment(order);
                  }
                  router.push(`${ROUTES.checkout}?orderId=${orderId}`);
                } catch {
                  router.push(`${ROUTES.checkout}?orderId=${orderId}`);
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying}
              className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className={cn('h-4 w-4', retrying && 'animate-spin')} />
              {retrying ? 'Loading Checkout...' : 'Try Payment Again'}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => router.push(ROUTES.orderDetail(orderId))}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold h-11 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <Package className="h-4 w-4" /> View Order Details
          </Button>

          <Button
            variant="ghost"
            onClick={() => router.push(ROUTES.cart)}
            className="text-slate-600 hover:bg-slate-50 font-semibold h-11 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            Back to Cart <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
