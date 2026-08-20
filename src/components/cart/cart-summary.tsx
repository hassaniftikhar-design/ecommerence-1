"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { placeOrder, PriceChangedError } from "@/services/cart.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TAX_RATE } from "@/constants/generalconstants";
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
  const [priceChangedAlert, setPriceChangedAlert] = useState<{ isOpen: boolean; newTotal: number }>({ isOpen: false, newTotal: 0 });

  const hasSelectedItems = selectedItemIds.length > 0;

  // Reset orderFailed whenever user changes item selections or cart totals
  useEffect(() => {
    setOrderFailed(false);
  }, [selectedItemIds, totals]);

  const handlePlaceOrder = async (forceProceed = false) => {
    if (isEmpty || !hasSelectedItems || loading || orderFailed) return;
    try {
      setLoading(true);
      setOrderFailed(false);
      const expectedTotalToPass = forceProceed ? priceChangedAlert.newTotal : totals.total;
      const res = await placeOrder(selectedItemIds, expectedTotalToPass);
      showSuccess("Order is successfully placed!");
      setPriceChangedAlert({ isOpen: false, newTotal: 0 });
      onOrderPlaced?.(res);
    } catch (err) {
      if (err instanceof PriceChangedError) {
        setPriceChangedAlert({ isOpen: true, newTotal: err.newTotal });
        return;
      }
      setOrderFailed(true);
      const errorMsg = (err as Error).message || "Failed to place order";
      onOutOfStockError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = isEmpty || loading || !hasSelectedItems || orderFailed;

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
        onClick={() => handlePlaceOrder(false)}
        disabled={isButtonDisabled}
        className="mt-2 w-full max-w-xs bg-[#007BFF] hover:bg-blue-600 text-white font-semibold h-11 text-base rounded-xl shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 transition-all"
      >
        {loading
          ? "Placing Order..."
          : "Place Order"}
      </Button>

      <AlertDialog open={priceChangedAlert.isOpen} onOpenChange={(open) => setPriceChangedAlert(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Price Updated</AlertDialogTitle>
            <AlertDialogDescription>
              The prices for some items in your cart have changed since you added them. 
              Your new total is <strong className="text-slate-900">${priceChangedAlert.newTotal.toFixed(2)}</strong>. 
              Do you still want to place this order?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handlePlaceOrder(true);
              }}
              disabled={loading}
              className="bg-[#007BFF] hover:bg-blue-600 text-white"
            >
              {loading ? "Placing Order..." : "Place Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
