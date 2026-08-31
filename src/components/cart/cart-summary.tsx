"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TAX_RATE } from "@/constants/generalconstants";
import { ROUTES } from "@/constants/routes";
import type { CartTotals } from "@/types/cart.types";

interface CartSummaryProps {
  totals: CartTotals;
  isEmpty?: boolean;
  selectedItemIds?: string[];
  onProceedToCheckout?: () => void;
  loading?: boolean;
}

export function CartSummary({
  totals,
  isEmpty = false,
  selectedItemIds = [],
  onProceedToCheckout,
  loading = false,
}: CartSummaryProps) {
  const router = useRouter();
  const hasSelectedItems = selectedItemIds.length > 0;

  const handleProceed = () => {
    if (isEmpty || !hasSelectedItems || loading) return;
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else {
      router.push(ROUTES.checkout);
    }
  };

  const isButtonDisabled = isEmpty || !hasSelectedItems || loading;

  return (
    <div className="mt-8 flex flex-col items-center sm:items-end gap-3 w-full">
      <div className="w-full max-w-xs space-y-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Sub Total:</span>
          <span className="font-semibold text-slate-900">${totals.subTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Tax ({Math.round(TAX_RATE * 100)}%):</span>
          <span className="font-semibold text-slate-900">${totals.tax.toFixed(2)}</span>
        </div>
        <hr className="border-slate-100 my-1" />
        <div className="flex justify-between text-base font-bold text-slate-900">
          <span>Total:</span>
          <span className="text-[#007BFF]">${totals.total.toFixed(2)}</span>
        </div>
      </div>

      <Button
        onClick={handleProceed}
        disabled={isButtonDisabled}
        className="mt-2 w-full max-w-xs bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 text-base rounded-xl shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Checking Stock...
          </span>
        ) : (
          "Proceed to Checkout"
        )}
      </Button>
    </div>
  );
}
