'use client';

import React, { useState } from 'react';

import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
  MAX_VISIBLE_SIZES_DESKTOP,
  MAX_VISIBLE_SIZES_MOBILE
} from '@/constants/generalconstants';
import { useIsMobile } from '@/hooks/use-is-mobile';

export interface ProductSizeSelectorProps {
  sizes: string[];
  selectedSize: string;
  onSelectSize: (size: string) => void;
  className?: string;
}

export function ProductSizeSelector({
  sizes,
  selectedSize,
  onSelectSize,
  className
}: ProductSizeSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const isMobile = useIsMobile();

  // If product has no sizes, do not render size selector
  if (!sizes || sizes.length === 0) {
    return null;
  }

  const maxSizes = isMobile ? MAX_VISIBLE_SIZES_MOBILE : MAX_VISIBLE_SIZES_DESKTOP;
  const activeSize = selectedSize || sizes[0] || '';
  const isOverMax = sizes.length > maxSizes;

  // Render Select Dropdown mode if sizes > maxSizes and dropdown is active
  if (isOverMax && showDropdown) {
    return (
      <div className={cn('flex flex-col gap-1.5 w-full', className)}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Size: <span className="text-slate-800 font-bold">{activeSize}</span>
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between text-xs text-slate-700 font-medium cursor-pointer transition shadow-2xs"
            >
              <span className="truncate font-semibold">{activeSize}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36 bg-white border border-slate-200 shadow-lg rounded-lg p-1 z-[100]">
            {sizes.map((size) => {
              const isSelected = activeSize.toLowerCase() === size.toLowerCase();

              return (
                <DropdownMenuItem
                  key={size}
                  onClick={() => onSelectSize(size)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50 text-[#007BFF] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <div className="w-4 flex items-center justify-center shrink-0">
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#007BFF]" />}
                  </div>
                  <span>{size}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Render Chips Mode (2 max on mobile, 4 max on desktop)
  const visibleSizes = isOverMax ? sizes.slice(0, maxSizes) : sizes;
  const remainingCount = sizes.length - maxSizes;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Size: <span className="text-slate-800 font-bold">{activeSize}</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleSizes.map((size) => {
          const isSelected = activeSize.toLowerCase() === size.toLowerCase();

          return (
            <button
              key={size}
              type="button"
              onClick={() => onSelectSize(size)}
              className={cn(
                'px-2 py-0.5 rounded-md text-xs transition-all cursor-pointer border shrink-0',
                isSelected
                  ? 'bg-[#007BFF] text-white font-bold border-[#007BFF] shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 font-medium hover:bg-slate-50 hover:border-slate-300'
              )}
            >
              {size}
            </button>
          );
        })}

        {isOverMax && (
          <button
            type="button"
            onClick={() => setShowDropdown(true)}
            title="Show all size options"
            className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 border border-slate-300/80 cursor-pointer transition flex items-center justify-center shrink-0"
          >
            +{remainingCount}
          </button>
        )}
      </div>
    </div>
  );
}
