"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { placeOrder } from "@/services/cart.service";
import type { CartTotals } from "@/types/cart.types";

interface CartSummaryProps {
  totals: CartTotals;
  isEmpty?: boolean;
  onOrderPlaced?: () => void;
}

export function CartSummary({ totals, isEmpty = false, onOrderPlaced }: CartSummaryProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (isEmpty) return;
    try {
      setLoading(true);
      await placeOrder();
      setSuccessMsg("Order placed successfully!");
      onOrderPlaced?.();
      setTimeout(() => {
        router.push(ROUTES.orders || "/orders");
      }, 1500);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col items-end gap-3 w-full">
      {successMsg && (
        <div className="w-full max-w-xs rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-600 text-center">
          {successMsg}
        </div>
      )}

      <div className="w-full max-w-xs space-y-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Sub Total:</span>
          <span className="font-semibold text-slate-900">${totals.subTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Tax (8%):</span>
          <span className="font-semibold text-slate-900">${totals.tax.toFixed(2)}</span>
        </div>
        <hr className="border-slate-100 my-1" />
        <div className="flex justify-between text-base font-bold text-slate-900">
          <span>Total:</span>
          <span className="text-[#007BFF]">${totals.total.toFixed(2)}</span>
        </div>
      </div>

      <Button
        onClick={handlePlaceOrder}
        disabled={isEmpty || loading}
        className="mt-2 w-full max-w-xs bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 text-base rounded-xl shadow-sm"
      >
        {loading ? "Placing Order..." : "Place Order"}
      </Button>
    </div>
  );
}
