"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { placeOrder } from "@/services/cart.service";
import type { CartTotals } from "@/types/cart.types";

interface CartSummaryProps {
  totals: CartTotals;
  isEmpty?: boolean;
  selectedItemIds?: string[];
  onOrderPlaced?: (order: { orderId: string; orderNumber: string }) => void;
  onOutOfStockError?: (message: string) => void;
}

export function CartSummary({
  totals,
  isEmpty = false,
  selectedItemIds = [],
  onOrderPlaced,
  onOutOfStockError,
}: CartSummaryProps) {
  const { showSuccess } = useToast();
  const [loading, setLoading] = useState(false);
  const [orderFailed, setOrderFailed] = useState(false);

  const hasSelectedItems = selectedItemIds.length > 0;

  // Reset orderFailed whenever user changes item selections or cart totals
  useEffect(() => {
    setOrderFailed(false);
  }, [selectedItemIds, totals]);

  const handlePlaceOrder = async () => {
    if (isEmpty || !hasSelectedItems || loading || orderFailed) return;
    try {
      setLoading(true);
      setOrderFailed(false);
      const res = await placeOrder(selectedItemIds);
      showSuccess("Order is successfully placed!");
      onOrderPlaced?.(res);
    } catch (err) {
      setOrderFailed(true);
      const errorMsg = (err as Error).message || "Failed to place order";
      const formattedMsg =
        errorMsg.toLowerCase().includes("out of stock") || errorMsg.includes("OUT_OF_STOCK")
          ? "Order can't be placed due to quantity going out of stock. Please update your cart quantity."
          : errorMsg;
      onOutOfStockError?.(formattedMsg);
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = isEmpty || loading || !hasSelectedItems || orderFailed;

  return (
    <div className="mt-8 flex flex-col items-end gap-3 w-full">
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
        disabled={isButtonDisabled}
        className="mt-2 w-full max-w-xs bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 text-base rounded-xl shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 transition-all"
      >
        {loading
          ? "Placing Order..."
          : "Place Order"}
      </Button>
    </div>
  );
}
