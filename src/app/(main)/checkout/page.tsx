"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/stripe-client";
import { getCart } from "@/services/cart.service";
import { getSavedPaymentMethods } from "@/services/payment.service";
import { getUserAddress } from "@/services/user.service";
import { ROUTES } from "@/constants/routes";
import { TAX_RATE } from "@/constants/generalconstants";
import { BackHeading } from "@/components/common/back-heading";
import { RequireLoginModal } from "@/components/auth/require-login-modal";
import { PriceChangedModal } from "@/components/checkout/price-changed-modal";
import { OutOfStockModal } from "@/components/cart/out-of-stock-modal";
import { ShippingAddressCard } from "@/components/checkout/shipping-address-card";
import { CheckoutStripeForm } from "@/components/checkout/checkout-stripe-form";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ShoppingBag, ShieldCheck } from "lucide-react";
import type { CartItem, CartTotals } from "@/types/cart.types";
import type { SavedPaymentMethod } from "@/types/payment.types";
import type { UserAddress } from "@/types/user.types";

function computeTotals(items: CartItem[]): CartTotals {
  const subTotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subTotal * TAX_RATE;
  const total = subTotal + tax;
  return {
    subTotal: Math.round(subTotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAuthenticated = status === "authenticated";
  const isUnauthenticated = status === "unauthenticated";

  const [items, setItems] = useState<CartItem[]>([]);
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [address, setAddress] = useState<UserAddress | null>(null);
  const [addressRequiredError, setAddressRequiredError] = useState(false);
  const [totals, setTotals] = useState<CartTotals>({
    subTotal: 0,
    tax: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outOfStockAlert, setOutOfStockAlert] = useState<string | null>(null);
  const [priceChangedAlert, setPriceChangedAlert] = useState<{
    isOpen: boolean;
    newTotal: number;
  }>({ isOpen: false, newTotal: 0 });

  const stripePromise = getStripe();

  const loadCheckoutData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const [cartData, cardsData, addressData] = await Promise.all([
        getCart(),
        getSavedPaymentMethods().catch(() => []),
        getUserAddress().catch(() => null),
      ]);

      if (cartData.items.length === 0) {
        router.replace(ROUTES.cart);
        return;
      }

      // Check for out-of-stock items before allowing checkout
      const outOfStockItem = cartData.items.find((item) => {
        const available = item.stock ?? 0;
        return available === 0 || item.quantity > available;
      });

      if (outOfStockItem) {
        const available = outOfStockItem.stock ?? 0;
        let msg = `Order can't be placed because '${outOfStockItem.name}' is currently out of stock. Please update your cart quantity.`;
        if (available > 0) {
          msg = `Order can't be placed because only ${available} unit(s) of '${outOfStockItem.name}' remain in stock (you requested ${outOfStockItem.quantity}). Please update your cart quantity.`;
        }
        setOutOfStockAlert(msg);
        return;
      }

      setItems(cartData.items);
      setSavedCards(cardsData);
      setAddress(addressData);
      setTotals(computeTotals(cartData.items));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (status === "authenticated") {
      loadCheckoutData();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, loadCheckoutData]);

  // Re-validate inventory & empty cart on browser back/forward navigation (bfcache)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        loadCheckoutData();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadCheckoutData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const selectedItemIds = items.map((i) => i.id);
  const amountInCents = Math.max(50, Math.round(totals.total * 100));

  const hasValidAddress = Boolean(
    address?.addressLine && address?.city && address?.postalCode && address?.country
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-6">
      <BackHeading title="Checkout" href={ROUTES.cart} />

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery Info & Payment */}
        <div className="lg:col-span-7 space-y-6">
          {/* Shipping Address Section */}
          <ShippingAddressCard
            address={address}
            onAddressUpdated={(newAddr) => {
              setAddress(newAddr);
              setAddressRequiredError(false);
            }}
            requiredError={addressRequiredError}
          />

          {/* Stripe Elements Payment Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <Elements
              stripe={stripePromise}
              options={{
                mode: "payment",
                amount: amountInCents,
                currency: "usd",
                setup_future_usage: "off_session",
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#007BFF",
                    borderRadius: "10px",
                  },
                },
              }}
            >
              <CheckoutStripeForm
                selectedItemIds={selectedItemIds}
                totalAmount={totals.total}
                savedCards={savedCards}
                hasValidAddress={hasValidAddress}
                onAddressMissing={() => setAddressRequiredError(true)}
                onPriceChanged={(newTotal) => {
                  setPriceChangedAlert({ isOpen: true, newTotal });
                }}
                onOutOfStock={(msg) => {
                  setOutOfStockAlert(msg);
                }}
              />
            </Elements>
          </div>
        </div>

        {/* Right Column: Order Summary Sidebar */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShoppingBag className="h-4 w-4 text-[#007BFF]" />
                <span>Order Summary</span>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {items.length} {items.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            {/* Cart Items List Preview */}
            <div className="max-h-60 overflow-y-auto space-y-3 pr-1 divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 pt-3 first:pt-0">
                  <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Qty: {item.quantity} × ${Number(item.price).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Calculation */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>${totals.subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Tax (10%)</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Due</span>
                <span className="text-[#007BFF]">${totals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 border border-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Safe & encrypted checkout. Powered by Stripe.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal for unauthenticated users */}
      <RequireLoginModal
        isOpen={isUnauthenticated}
        onClose={() => router.push(ROUTES.cart)}
        title="Sign In to Checkout"
        description="Please sign in or create an account to proceed with your order."
      />

      {/* Price Changed Conflict Modal */}
      <PriceChangedModal
        isOpen={priceChangedAlert.isOpen}
        newTotal={priceChangedAlert.newTotal}
        onAccept={() => {
          setPriceChangedAlert({ isOpen: false, newTotal: 0 });
          loadCheckoutData();
        }}
        onCancel={() => {
          setPriceChangedAlert({ isOpen: false, newTotal: 0 });
          router.push(ROUTES.cart);
        }}
      />

      {/* Out of Stock Alert Modal */}
      <OutOfStockModal
        isOpen={Boolean(outOfStockAlert)}
        message={outOfStockAlert || ""}
        onClose={() => {
          setOutOfStockAlert(null);
          router.push(ROUTES.cart);
        }}
      />
    </div>
  );
}
