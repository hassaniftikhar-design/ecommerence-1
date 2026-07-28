"use client";

import { Button } from "@/components/ui/button";
import type { CartTotals } from "@/types/cart.types";

interface CartSummaryProps {
  totals: CartTotals;
}

// Client Component -- not because the summary numbers are interactive
// (they're static props), but because "Place Order" needs an onClick
// handler, and Server Components can never attach event handlers to
// the elements they render, no matter how thin the wrapper. Same
// reasoning as ProductCard's placeholder "Add to Cart" handler.
// NOTE (scope decision, not an oversight): totals are computed once
// server-side from mock data and don't recompute live as someone
// adjusts a row's QuantitySelector. Real-time recalculation needs
// either lifted cart state or a client cart store, which only makes
// sense once actual prices (not $0.00 placeholders) exist -- that
// wiring belongs to the backend-integration phase.
export function CartSummary({ totals }: CartSummaryProps) {
  const handlePlaceOrder = () => {
    // TODO(backend-integration): call cart.service.ts#placeOrder().
  };

  return (
    <div className="mt-8 flex flex-col items-end gap-2">
      <div className="flex w-full max-w-xs justify-between text-ink">
        <span>Sub Total:</span>
        <span className="font-semibold">${totals.subTotal.toFixed(2)}</span>
      </div>
      <div className="flex w-full max-w-xs justify-between text-ink">
        <span>Tax:</span>
        <span className="font-semibold">${totals.tax.toFixed(2)}</span>
      </div>
      <div className="flex w-full max-w-xs justify-between text-ink">
        <span>Total:</span>
        <span className="font-semibold">${totals.total.toFixed(2)}</span>
      </div>
      <Button onClick={handlePlaceOrder} className="mt-4 w-full max-w-xs">
        Place Order
      </Button>
    </div>
  );
}
