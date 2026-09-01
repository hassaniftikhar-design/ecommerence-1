"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/stripe-client";
import { getCart, placeOrder, PriceChangedError } from "@/services/cart.service";
import { getSavedPaymentMethods } from "@/services/payment.service";
import { getUserAddress, updateUserAddress } from "@/services/user.service";
import { ROUTES } from "@/constants/routes";
import { TAX_RATE } from "@/constants/generalconstants";
import { RequireLoginModal } from "@/components/auth/require-login-modal";
import { PriceChangedModal } from "@/components/checkout/price-changed-modal";
import { OutOfStockModal } from "@/components/cart/out-of-stock-modal";
import { CheckoutStripeForm } from "@/components/checkout/checkout-stripe-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Hash,
  CreditCard,
  Banknote,
  Check,
  Lock,
  ShieldCheck,
  ShoppingBag,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Edit2,
} from "lucide-react";
import type { CartItem, CartTotals } from "@/types/cart.types";
import type { SavedPaymentMethod } from "@/types/payment.types";
import type { UserAddress } from "@/types/user.types";
import { cn } from "@/lib/utils";

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

  // Step state: "info" (Step 1) -> "payment" (Step 2)
  const [step, setStep] = useState<"info" | "payment">("info");

  // Payment type state: "cod" | "card"
  const [paymentType, setPaymentType] = useState<"cod" | "card">("cod");

  // Form data for Step 1
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    postalCode: "",
    country: "United States",
  });

  const [items, setItems] = useState<CartItem[]>([]);
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [address, setAddress] = useState<UserAddress | null>(null);
  const [totals, setTotals] = useState<CartTotals>({
    subTotal: 0,
    tax: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [codSubmitting, setCodSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

      // Populate address form data
      setFormData({
        fullName: session?.user?.name || addressData?.name || "",
        email: session?.user?.email || addressData?.email || "",
        phone: addressData?.phone || "",
        addressLine: addressData?.addressLine || "",
        city: addressData?.city || "",
        postalCode: addressData?.postalCode || "",
        country: addressData?.country || "United States",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, router, session]);

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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError(null);
  };

  // Step 1 -> Step 2 validation and address saving
  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      setFormError("Full Name is required");
      return;
    }
    if (!formData.email.trim()) {
      setFormError("Email Address is required");
      return;
    }
    if (!formData.phone.trim()) {
      setFormError("Phone Number is required");
      return;
    }
    if (!formData.addressLine.trim()) {
      setFormError("Street Address is required");
      return;
    }
    if (!formData.city.trim()) {
      setFormError("City is required");
      return;
    }
    if (!formData.postalCode.trim()) {
      setFormError("Postal Code is required");
      return;
    }

    try {
      setSavingAddress(true);
      setFormError(null);

      const updated = await updateUserAddress({
        addressLine: formData.addressLine.trim(),
        city: formData.city.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim() || "United States",
        phone: formData.phone.trim(),
      });

      setAddress(updated);
      setStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setFormError(err.message || "Failed to save address. Please try again.");
    } finally {
      setSavingAddress(false);
    }
  };

  // Place Cash on Delivery Order
  const handlePlaceCodOrder = async () => {
    try {
      setCodSubmitting(true);
      setError(null);

      const selectedItemIds = items.map((i) => i.id);
      const res = await placeOrder(selectedItemIds, totals.total);

      router.push(`/orders/${res.orderId}/payment-status`);
    } catch (err: any) {
      if (err instanceof PriceChangedError || err?.errors?.includes?.("PRICE_CHANGED")) {
        setPriceChangedAlert({
          isOpen: true,
          newTotal: err.newTotal || err?.data?.newTotal || 0,
        });
        return;
      }
      if (err?.errors?.includes?.("OUT_OF_STOCK") || err?.message?.toLowerCase()?.includes("out of stock")) {
        setOutOfStockAlert(err.message || "An item in your cart is currently out of stock. Please update your cart.");
        return;
      }
      setError(err.message || "Failed to place order. Please try again.");
    } finally {
      setCodSubmitting(false);
    }
  };

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

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-20 space-y-8">
      {/* Top Header & Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Checkout
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 mt-1">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            Complete your order in a few steps
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          {/* Step 1: Your Info */}
          <div
            onClick={() => setStep("info")}
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all text-xs font-bold",
                step === "info"
                  ? "border-2 border-[#007BFF] bg-white text-[#007BFF] shadow-xs"
                  : "bg-[#007BFF] text-white"
              )}
            >
              {step === "payment" ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <span
              className={cn(
                "text-[11px] font-semibold transition-colors",
                step === "info" ? "text-[#007BFF]" : "text-slate-700"
              )}
            >
              Your Info
            </span>
          </div>

          {/* Stepper Connector Bar */}
          <div
            className={cn(
              "h-0.5 w-16 sm:w-20 transition-all rounded-full mb-4",
              step === "payment" ? "bg-[#007BFF]" : "bg-slate-200"
            )}
          />

          {/* Step 2: Payment */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all text-xs font-bold",
                step === "payment"
                  ? "border-2 border-[#007BFF] bg-white text-[#007BFF] shadow-xs"
                  : "border border-slate-200 bg-white text-slate-400"
              )}
            >
              <CreditCard className="h-4 w-4" />
            </div>
            <span
              className={cn(
                "text-[11px] font-semibold transition-colors",
                step === "payment" ? "text-[#007BFF]" : "text-slate-400"
              )}
            >
              Payment
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Content */}
        <div className="lg:col-span-7 space-y-6">
          {/* ======================================================== */}
          {/* STEP 1: DELIVERY INFORMATION FORM */}
          {/* ======================================================== */}
          {step === "info" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Delivery information
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Where should we send your order?
                </p>
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span className="flex-1">{formError}</span>
                </div>
              )}

              <form onSubmit={handleContinueToPayment} className="space-y-5">
                {/* CONTACT SECTION */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                    Contact
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={(e) => handleInputChange("fullName", e.target.value)}
                        className="pl-10 h-11 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-[#007BFF]"
                      />
                    </div>
                  </div>

                  {/* Email & Phone (2-Columns) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          className="pl-10 h-11 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="tel"
                          placeholder="(555) 000-0000"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          className="pl-10 h-11 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-[#007BFF]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SHIPPING ADDRESS SECTION */}
                <div className="space-y-3.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                    Shipping Address
                  </div>

                  {/* Street Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="123 Main Street, Apt 4B"
                        value={formData.addressLine}
                        onChange={(e) => handleInputChange("addressLine", e.target.value)}
                        className="pl-10 h-11 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-[#007BFF]"
                      />
                    </div>
                  </div>

                  {/* City & Postal Code (2-Columns) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        City <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="New York"
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          className="pl-10 h-11 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Postal Code <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="10001"
                          value={formData.postalCode}
                          onChange={(e) => handleInputChange("postalCode", e.target.value)}
                          className="pl-10 h-11 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-[#007BFF]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Continue to Payment Button */}
                <div className="pt-4 space-y-3">
                  <Button
                    type="submit"
                    disabled={savingAddress}
                    className="w-full h-12 bg-[#007BFF] hover:bg-blue-600 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {savingAddress ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving Information...
                      </span>
                    ) : (
                      <>
                        Continue to Payment <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => router.push(ROUTES.cart)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      ← Back to Cart
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: PAYMENT DETAILS & METHOD SELECTION */}
          {/* ======================================================== */}
          {step === "payment" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Payment details
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Choose how you'd like to pay
                </p>
              </div>

              {/* DELIVER TO Summary Box */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                      Deliver to
                    </span>
                    <p className="font-bold text-slate-900 text-sm truncate mt-0.5">
                      {formData.fullName || address?.name || "Recipient"}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {formData.phone || address?.phone || "No phone provided"}
                    </p>
                    <p className="text-slate-600 text-xs truncate mt-0.5">
                      {formData.addressLine}, {formData.city} — {formData.postalCode}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("info")}
                  className="text-xs font-bold text-[#007BFF] hover:underline shrink-0 pt-1"
                >
                  Edit
                </button>
              </div>

              {/* PAYMENT METHOD SELECTION SECTION */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  Payment Method
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Option 1: Cash on Delivery */}
                  <div
                    onClick={() => setPaymentType("cod")}
                    className={cn(
                      "relative rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between space-y-3",
                      paymentType === "cod"
                        ? "border-2 border-[#007BFF] bg-blue-50/20 shadow-2xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Banknote className="h-5 w-5" />
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border flex items-center justify-center transition-all",
                          paymentType === "cod"
                            ? "border-[#007BFF] bg-white"
                            : "border-slate-300 bg-white"
                        )}
                      >
                        {paymentType === "cod" && (
                          <div className="h-2 w-2 rounded-full bg-[#007BFF]" />
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Cash on Delivery
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Pay with cash when your order arrives.
                      </p>
                    </div>

                    <div>
                      <span className="inline-block rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        No card needed
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Credit / Debit Card */}
                  <div
                    onClick={() => setPaymentType("card")}
                    className={cn(
                      "relative rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between space-y-3",
                      paymentType === "card"
                        ? "border-2 border-[#007BFF] bg-blue-50/20 shadow-2xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#007BFF]">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border flex items-center justify-center transition-all",
                          paymentType === "card"
                            ? "border-[#007BFF] bg-white"
                            : "border-slate-300 bg-white"
                        )}
                      >
                        {paymentType === "card" && (
                          <div className="h-2 w-2 rounded-full bg-[#007BFF]" />
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Credit / Debit Card
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Pay securely with Visa, Mastercard, and more.
                      </p>
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-semibold text-[#007BFF]">
                        <ShieldCheck className="h-3 w-3" /> SSL encrypted
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAYMENT SUBMISSION CONTENT */}
              {paymentType === "cod" ? (
                /* Cash on Delivery submission button */
                <div className="pt-2 space-y-3">
                  <Button
                    type="button"
                    onClick={handlePlaceCodOrder}
                    disabled={codSubmitting}
                    className="w-full h-12 bg-[#007BFF] hover:bg-blue-600 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {codSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Placing Order...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" /> Place Order (Cash on Delivery)
                      </span>
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setStep("info")}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      ← Back to Delivery Info
                    </button>
                  </div>
                </div>
              ) : (
                /* Credit/Debit card form via Stripe Elements */
                <div className="pt-2">
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
                      hasValidAddress={Boolean(formData.addressLine && formData.city)}
                      onBackToInfo={() => setStep("info")}
                      onAddressMissing={() => setStep("info")}
                      onPriceChanged={(newTotal) => {
                        setPriceChangedAlert({ isOpen: true, newTotal });
                      }}
                      onOutOfStock={(msg) => {
                        setOutOfStockAlert(msg);
                      }}
                    />
                  </Elements>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Order Summary Card (Matching Mockup) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Top Blue Header Banner */}
            <div className="bg-[#007BFF] p-5 sm:p-6 text-white space-y-1">
              <span className="text-[11px] font-bold tracking-widest text-blue-100 uppercase">
                Total to Pay
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                ${totals.total.toFixed(2)}
              </div>
              <p className="text-xs text-blue-100/90 pt-0.5">
                {items.length} {items.length === 1 ? "item" : "items"} · includes ${totals.tax.toFixed(2)} tax
              </p>
            </div>

            {/* Content Body */}
            <div className="bg-white p-5 space-y-4">
              {/* Cart Items Preview List */}
              <div className="max-h-60 overflow-y-auto space-y-3.5 pr-1 divide-y divide-slate-100">
                {items.map((item) => {
                  const colorName =
                    typeof item.color === "object"
                      ? item.color?.name
                      : item.color || "";

                  return (
                    <div key={item.id} className="flex items-center gap-3 pt-3.5 first:pt-0">
                      {/* Product Thumbnail with badge */}
                      <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow-xs">
                          {item.quantity}
                        </span>
                      </div>

                      {/* Product details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.name}
                          </p>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 shrink-0">
                            ${(Number(item.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        {colorName && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{colorName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">${totals.subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-semibold text-slate-800">${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-dashed border-slate-200 pt-2.5">
                  <span>Total</span>
                  <span className="text-[#007BFF] text-base font-extrabold">${totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Security footer badges */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-slate-400" /> SSL Secure
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Encrypted checkout
                </span>
              </div>
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
