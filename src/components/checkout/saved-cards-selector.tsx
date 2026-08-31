"use client";

import React from "react";
import { CreditCard, PlusCircle, CheckCircle2 } from "lucide-react";
import type { SavedPaymentMethod } from "@/types/payment.types";
import { cn } from "@/lib/utils";

interface SavedCardsSelectorProps {
  savedCards: SavedPaymentMethod[];
  selectedCardId: string | "new";
  onSelect: (id: string | "new") => void;
  disabled?: boolean;
}

function formatCardBrand(brand: string): string {
  const b = brand.toLowerCase();
  if (b === "visa") return "Visa";
  if (b === "mastercard") return "Mastercard";
  if (b === "amex" || b === "american express") return "American Express";
  if (b === "discover") return "Discover";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function SavedCardsSelector({
  savedCards,
  selectedCardId,
  onSelect,
  disabled = false,
}: SavedCardsSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-800">
        Choose Payment Method
      </div>

      <div className="space-y-2.5">
        {savedCards.map((card) => {
          const isSelected = selectedCardId === card.id;

          return (
            <label
              key={card.id}
              onClick={() => !disabled && onSelect(card.id)}
              className={cn(
                "relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                isSelected
                  ? "border-[#007BFF] bg-blue-50/40 ring-1 ring-[#007BFF]/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3.5">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={card.id}
                  checked={isSelected}
                  onChange={() => onSelect(card.id)}
                  disabled={disabled}
                  className="h-4 w-4 text-[#007BFF] border-slate-300 focus:ring-[#007BFF]"
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">
                      {formatCardBrand(card.brand)}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      •••• {card.last4}
                    </span>
                    {card.isDefault && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#007BFF]">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                  </p>
                </div>
              </div>

              {isSelected && (
                <CheckCircle2 className="h-5 w-5 text-[#007BFF] shrink-0" />
              )}
            </label>
          );
        })}

        {/* Option to Add and Use New Card */}
        <label
          onClick={() => !disabled && onSelect("new")}
          className={cn(
            "relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
            selectedCardId === "new"
              ? "border-[#007BFF] bg-blue-50/40 ring-1 ring-[#007BFF]/20"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-3.5">
            <input
              type="radio"
              name="paymentMethod"
              value="new"
              checked={selectedCardId === "new"}
              onChange={() => onSelect("new")}
              disabled={disabled}
              className="h-4 w-4 text-[#007BFF] border-slate-300 focus:ring-[#007BFF]"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-[#007BFF]">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-sm text-slate-900">
                {savedCards.length > 0 ? "Use a new credit or debit card" : "Pay with Credit or Debit Card"}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Stripe secure card payment
              </p>
            </div>
          </div>

          {selectedCardId === "new" && (
            <CheckCircle2 className="h-5 w-5 text-[#007BFF] shrink-0" />
          )}
        </label>
      </div>
    </div>
  );
}
