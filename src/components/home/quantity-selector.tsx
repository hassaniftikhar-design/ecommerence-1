"use client";

import { useEffect, useState, useRef } from "react";
import { Minus, Plus, AlertTriangle } from "lucide-react";

interface QuantitySelectorProps {
  initialValue: number;
  max?: number;
  onChange?: (quantity: number) => void;
}

export function QuantitySelector({
  initialValue,
  max,
  onChange,
}: QuantitySelectorProps) {
  const [quantity, setQuantity] = useState(initialValue);
  const [inputValue, setInputValue] = useState(String(initialValue));
  const [isFocused, setIsFocused] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state with initialValue prop when not actively focused
  useEffect(() => {
    if (!isFocused) {
      setQuantity(initialValue);
      setInputValue(String(initialValue));
    }
  }, [initialValue, isFocused]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  const triggerErrorPopup = () => {
    setShowPopup(true);
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    popupTimeoutRef.current = setTimeout(() => {
      setShowPopup(false);
    }, 3000);
  };

  const handleIncrement = () => {
    if (max !== undefined && quantity >= max) return;
    const nextVal = quantity + 1;
    setQuantity(nextVal);
    setInputValue(String(nextVal));
    setShowPopup(false);
    onChange?.(nextVal);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      const nextVal = quantity - 1;
      setQuantity(nextVal);
      setInputValue(String(nextVal));
      setShowPopup(false);
      onChange?.(nextVal);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setInputValue(rawVal);

    if (rawVal === "") {
      return;
    }

    const parsed = parseInt(rawVal, 10);

    if (isNaN(parsed) || parsed <= 0) {
      triggerErrorPopup();
      setQuantity(1);
      setInputValue("1");
      onChange?.(1);
      return;
    }

    if (max !== undefined && parsed > max) {
      setQuantity(max);
      setInputValue(String(max));
      setShowPopup(false);
      onChange?.(max);
      return;
    }

    setShowPopup(false);
    setQuantity(parsed);
    onChange?.(parsed);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseInt(inputValue, 10);

    if (isNaN(parsed) || parsed <= 0) {
      triggerErrorPopup();
      setQuantity(1);
      setInputValue("1");
      onChange?.(1);
    } else if (max !== undefined && parsed > max) {
      setQuantity(max);
      setInputValue(String(max));
      onChange?.(max);
    } else {
      setInputValue(String(parsed));
    }
  };

  const isMaxReached = max !== undefined && quantity >= max;

  return (
    <div className="relative flex w-auto items-center gap-0.5 max-[395px]:w-full max-[395px]:justify-between max-[395px]:gap-1 @xs:gap-1">
      {/* Error Popup Notification */}
      {showPopup && (
        <div
          role="alert"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] w-[210px] sm:w-[230px] rounded-md border border-red-500 bg-[#FFF0F0] p-3 shadow-md animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
        >
          <div className="flex items-center gap-1.5 font-semibold text-red-500 text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>Sorry</span>
          </div>
          <p className="mt-1 text-[11px] sm:text-xs text-slate-800 font-normal leading-snug">
            Please enter a valid quantity
          </p>
          {/* Tooltip Downward Arrow */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-red-500" />
          <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#FFF0F0]" />
        </div>
      )}

      <button
        type="button"
        onClick={handleDecrement}
        disabled={quantity <= 1}
        aria-label="Decrease quantity"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E2E8F0] text-[#007BFF] transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed max-[395px]:h-8 max-[395px]:w-8 @xs:h-8 @xs:w-8"
      >
        <Minus className="h-3 w-3 max-[395px]:h-4 max-[395px]:w-4 @xs:h-4 @xs:w-4" />
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label="Quantity"
        className="h-7 w-8 sm:w-10 rounded border border-[#E2E8F0] bg-white text-center text-[11px] sm:text-xs font-medium text-gray-900 focus:border-[#007BFF] focus:outline-none focus:ring-1 focus:ring-[#007BFF] transition-all max-[395px]:h-8 max-[395px]:flex-1"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={isMaxReached}
        aria-label="Increase quantity"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E2E8F0] text-[#007BFF] transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed max-[395px]:h-8 max-[395px]:w-8 @xs:h-8 @xs:w-8"
      >
        <Plus className="h-3 w-3 max-[395px]:h-4 max-[395px]:w-4 @xs:h-4 @xs:w-4" />
      </button>
    </div>
  );
}