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
  MAX_VISIBLE_COLORS_DESKTOP,
  MAX_VISIBLE_COLORS_MOBILE,
  getColorHex
} from '@/constants/generalconstants';
import { useIsMobile } from '@/hooks/use-is-mobile';

export interface ProductColorSelectorProps {
  colors: string[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  className?: string;
}

export function ProductColorSelector({
  colors,
  selectedColor,
  onSelectColor,
  className
}: ProductColorSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const isMobile = useIsMobile();

  // If product has no colors, do not render color selector
  if (!colors || colors.length === 0) {
    return null;
  }

  const maxColors = isMobile ? MAX_VISIBLE_COLORS_MOBILE : MAX_VISIBLE_COLORS_DESKTOP;
  const activeColor = selectedColor || colors[0] || '';
  const isOverMax = colors.length > maxColors;

  // Render Select Dropdown mode if colors > maxColors and dropdown is active
  if (isOverMax && showDropdown) {
    const activeHex = getColorHex(activeColor);
    const isActiveWhite = activeColor.toLowerCase() === 'white' || activeHex.toLowerCase() === '#ffffff';

    return (
      <div className={cn('flex flex-col gap-1.5 w-full', className)}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Color: <span className="text-slate-800 font-bold capitalize">{activeColor}</span>
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between text-xs text-slate-700 font-medium cursor-pointer transition shadow-2xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={cn(
                    'h-3.5 w-3.5 rounded-full shrink-0 border border-slate-300/80 shadow-2xs',
                    isActiveWhite && 'border-slate-400'
                  )}
                  style={{ backgroundColor: activeHex }}
                />
                <span className="truncate capitalize font-semibold">{activeColor}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 bg-white border border-slate-200 shadow-lg rounded-lg p-1 z-[100]">
            {colors.map((color) => {
              const isSelected = activeColor.toLowerCase() === color.toLowerCase();
              const hex = getColorHex(color);
              const isWhite = color.toLowerCase() === 'white' || hex.toLowerCase() === '#ffffff';

              return (
                <DropdownMenuItem
                  key={color}
                  onClick={() => onSelectColor(color)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50 text-[#007BFF] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <div className="w-4 flex items-center justify-center shrink-0">
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#007BFF]" />}
                  </div>
                  <span
                    className={cn(
                      'h-3.5 w-3.5 rounded-full shrink-0 border border-slate-300/80 shadow-2xs',
                      isWhite && 'border-slate-400'
                    )}
                    style={{ backgroundColor: hex }}
                  />
                  <span className="capitalize">{color}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Render Swatches Mode (3 max on mobile, 4 max on desktop)
  const visibleColors = isOverMax ? colors.slice(0, maxColors) : colors;
  const remainingCount = colors.length - maxColors;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Color: <span className="text-slate-800 font-bold capitalize">{activeColor}</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleColors.map((color) => {
          const isSelected = activeColor.toLowerCase() === color.toLowerCase();
          const hex = getColorHex(color);
          const isWhite = color.toLowerCase() === 'white' || hex.toLowerCase() === '#ffffff';

          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelectColor(color)}
              title={color}
              className={cn(
                'relative rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0',
                isSelected
                  ? 'h-6 w-6 ring-2 ring-slate-900 ring-offset-1 shadow-sm scale-110'
                  : 'h-5 w-5 hover:scale-110 opacity-80 hover:opacity-100'
              )}
            >
              <span
                className={cn(
                  'h-full w-full rounded-full border border-black/10 shadow-2xs',
                  isWhite && 'border-slate-300'
                )}
                style={{ backgroundColor: hex }}
              />
            </button>
          );
        })}

        {isOverMax && (
          <button
            type="button"
            onClick={() => setShowDropdown(true)}
            title="Show all color options"
            className="h-5 px-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 border border-slate-300/80 cursor-pointer transition-transform hover:scale-105 flex items-center justify-center shrink-0"
          >
            +{remainingCount}
          </button>
        )}
      </div>
    </div>
  );
}
