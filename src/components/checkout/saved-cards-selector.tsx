'use client';

import React from 'react';

import { Plus, Star } from 'lucide-react';

import type { SavedPaymentMethod } from '@/types/payment.types';
import { cn } from '@/lib/utils';

interface SavedCardsSelectorProps {
  savedCards: SavedPaymentMethod[];
  selectedCardId: string | 'new';
  onSelect: (id: string | 'new') => void;
  disabled?: boolean;
}

function formatCardBrand(brand: string): string {
  const b = brand.toLowerCase();
  if (b === 'visa') return 'Visa';
  if (b === 'mastercard') return 'Mastercard';
  if (b === 'amex' || b === 'american express') return 'American Express';
  if (b === 'discover') return 'Discover';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function CardBrandBadge({ brand }: { brand: string }) {
  const b = brand.toLowerCase();
  if (b === 'visa') {
    return (
      <span className="bg-[#1A1F71] text-white text-[11px] font-black italic tracking-wider px-2.5 py-0.5 rounded">
        VISA
      </span>
    );
  }
  if (b === 'mastercard') {
    return (
      <span className="bg-[#EB001B] text-white text-[10px] font-bold px-2 py-0.5 rounded">
        MC
      </span>
    );
  }
  return (
    <span className="bg-slate-800 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">
      {brand.slice(0, 4)}
    </span>
  );
}

export function SavedCardsSelector({
  savedCards,
  selectedCardId,
  onSelect,
  disabled = false
}: SavedCardsSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
        Select Card
      </div>

      <div className="space-y-2.5">
        {savedCards.map((card) => {
          const isSelected = selectedCardId === card.id;

          return (
            <label
              key={card.id}
              onClick={() => !disabled && onSelect(card.id)}
              className={cn(
                'relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer',
                isSelected
                  ? 'border-2 border-[#007BFF] bg-blue-50/20 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center">
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full border flex items-center justify-center transition-all',
                      isSelected
                        ? 'border-[#007BFF] bg-white'
                        : 'border-slate-300 bg-white'
                    )}
                  >
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-[#007BFF]" />
                    )}
                  </div>
                </div>

                <CardBrandBadge brand={card.brand} />

                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                  <span>{formatCardBrand(card.brand)}</span>
                  <span className="font-mono text-slate-600">•••• {card.last4}</span>
                  <span className="text-slate-400 text-xs font-normal">
                    {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                  </span>
                </div>
              </div>

              {card.isDefault && (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> Default
                </span>
              )}
            </label>
          );
        })}

        {/* Option to Add New Card */}
        <label
          onClick={() => !disabled && onSelect('new')}
          className={cn(
            'relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer',
            selectedCardId === 'new'
              ? 'border-2 border-[#007BFF] bg-blue-50/20 shadow-2xs'
              : 'border border-dashed border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <div
                className={cn(
                  'h-4 w-4 rounded-full border flex items-center justify-center transition-all',
                  selectedCardId === 'new'
                    ? 'border-[#007BFF] bg-white'
                    : 'border-slate-300 bg-white'
                )}
              >
                {selectedCardId === 'new' && (
                  <div className="h-2 w-2 rounded-full bg-[#007BFF]" />
                )}
              </div>
            </div>

            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[#007BFF]">
              <Plus className="h-3.5 w-3.5" />
            </div>

            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Add new card
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}
