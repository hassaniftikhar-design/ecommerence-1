"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderId?: string;
  orderNumber: string;
  onContinueShopping: () => void;
  onViewOrderDetails: () => void;
}

export function OrderSuccessModal({
  isOpen,
  orderNumber,
  onContinueShopping,
  onViewOrderDetails,
}: OrderSuccessModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
      {/* Non-interactive backdrop overlay (No close on click) */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300" />

      {/* Decision-making Popup Card */}
      <div className="relative z-[10000] w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Success Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
          <CheckCircle2 className="h-10 w-10 stroke-[2.2]" />
        </div>

        {/* Heading & Subheading */}
        <h3 className="text-xl font-bold text-slate-900">Order Placed</h3>
        <p className="text-sm text-slate-500 mt-1">
          Your order has been placed successfully.
        </p>

        {/* Order Number Badge */}
        <div className="my-5 inline-block bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-[#007BFF]">
          Order #{orderNumber}
        </div>

        {/* Decision Action Buttons (Mandatory 2 options, no close option) */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full">
          <Button
            type="button"
            onClick={onContinueShopping}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold h-11 rounded-xl text-xs sm:text-sm border border-slate-200 transition"
          >
            Continue Shopping
          </Button>

          <Button
            type="button"
            onClick={onViewOrderDetails}
            className="flex-1 bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 rounded-xl text-xs sm:text-sm shadow-sm transition"
          >
            View Order Details
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
