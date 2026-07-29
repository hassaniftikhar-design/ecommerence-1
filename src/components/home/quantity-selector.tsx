"use client";

import { Minus, Plus } from "lucide-react";

import { useQuantity } from "@/hooks/use-quantity";

interface QuantitySelectorProps {
  initialValue: number;
  onChange?: (quantity: number) => void;
}

export function QuantitySelector({
  initialValue,
  onChange,
}: QuantitySelectorProps) {
  const { quantity, increment, decrement } = useQuantity(initialValue);

  const handleIncrement = () => {
    increment();
    onChange?.(quantity + 1);
  };
  const handleDecrement = () => {
    decrement();
    onChange?.(quantity - 1);
  };

  return (
    <div className="flex items-center gap-1">
  <button
    type="button"
    onClick={handleDecrement}
    aria-label="Decrease quantity"
    className="flex h-9 w-9 items-center justify-center rounded border border-border text-primary hover:bg-surface-page"
  >
    <Minus className="h-4 w-4" />
  </button>

  <span
    aria-live="polite"
    className="flex h-9 w-[44px] items-center justify-center rounded border border-border text-sm text-ink"
  >
    {String(quantity)}
  </span>

  <button
    type="button"
    onClick={handleIncrement}
    aria-label="Increase quantity"
    className="flex h-9 w-9 items-center justify-center rounded border border-border text-primary hover:bg-surface-page"
  >
    <Plus className="h-4 w-4" />
  </button>
</div>
  );
}
