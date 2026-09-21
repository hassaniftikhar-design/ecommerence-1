'use client';

import React from 'react';

import { AlertCircle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export interface ChangedPriceItem {
  name: string;
  oldPrice?: number;
  newPrice?: number;
  price?: number;
}

export interface PriceChangedModalProps {
  isOpen: boolean;
  newTotal: number;
  oldTotal?: number;
  changedItems?: (ChangedPriceItem | string)[];
  cancelText?: string;
  acceptText?: string;
  onAccept: () => void;
  onCancel: () => void;
}

export function PriceChangedModal({
  isOpen,
  newTotal,
  oldTotal,
  changedItems = [],
  cancelText = 'Cancel',
  acceptText = 'Accept and Proceed',
  onAccept,
  onCancel
}: PriceChangedModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5 shrink-0" /> Price Updated
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-xs text-slate-600 space-y-3.5 pt-1">
              <span>
                One or more product prices in your order have been updated:
              </span>

              {changedItems && changedItems.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2 max-h-48 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Updated Products
                  </span>
                  <ul className="space-y-2 divide-y divide-slate-100">
                    {changedItems.map((item, idx) => {
                      const name = typeof item === 'string' ? item : item.name;
                      const oldPrice = typeof item === 'object' && item.oldPrice !== undefined ? item.oldPrice : null;
                      const newPrice = typeof item === 'object' ? (item.newPrice ?? item.price ?? null) : null;

                      return (
                        <li key={idx} className="flex items-center justify-between gap-2 pt-1.5 first:pt-0">
                          <span className="font-semibold text-slate-800 text-xs truncate max-w-[210px]" title={name}>
                            {name}
                          </span>
                          {oldPrice !== null && newPrice !== null ? (
                            <span className="shrink-0 text-xs font-mono flex items-center gap-1.5">
                              <span className="line-through text-slate-400">${Number(oldPrice).toFixed(2)}</span>
                              <span className="text-slate-400">→</span>
                              <span className="font-bold text-[#007BFF]">${Number(newPrice).toFixed(2)}</span>
                            </span>
                          ) : newPrice !== null ? (
                            <span className="shrink-0 text-xs font-mono font-bold text-[#007BFF]">
                              ${Number(newPrice).toFixed(2)}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
                {oldTotal !== undefined && Number(oldTotal) !== Number(newTotal) ? (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Previous Total:</span>
                    <span className="line-through font-mono font-medium">${Number(oldTotal).toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">New Order Total:</span>
                  <span className="font-extrabold text-[#007BFF] text-base">
                    ${Number(newTotal).toFixed(2)}
                  </span>
                </div>
              </div>

              <span className="block text-slate-500 text-[11px]">
                Would you like to proceed with the updated total?
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel onClick={onCancel} className="text-xs cursor-pointer">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onAccept}
            className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-semibold cursor-pointer"
          >
            {acceptText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PriceChangedModal;
