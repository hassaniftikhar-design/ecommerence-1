'use client';

import React from 'react';

import { AlertTriangle, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface OutOfStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  title?: string;
}

export function OutOfStockModal({
  isOpen,
  onClose,
  title = 'Order Can\'t Be Placed',
  message = 'Order can\'t be placed due to quantity going out of stock. Please update your cart quantity.'
}: OutOfStockModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-2xs">
            <AlertTriangle className="h-6 w-6 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {title}
            </h3>
            <p className="text-xs font-medium text-amber-600">
              Action Required
            </p>
          </div>
        </div>

        {/* Description Message */}
        <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80">
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <Button
            onClick={onClose}
            className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-semibold text-sm h-10 rounded-xl"
          >
            Update Cart Quantity
          </Button>
        </div>
      </div>
    </div>
  );
}
