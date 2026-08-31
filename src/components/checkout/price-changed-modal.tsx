"use client";

import React from "react";
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
import { AlertCircle } from "lucide-react";

export interface PriceChangedModalProps {
  isOpen: boolean;
  newTotal: number;
  onAccept: () => void;
  onCancel: () => void;
}

export function PriceChangedModal({
  isOpen,
  newTotal,
  onAccept,
  onCancel,
}: PriceChangedModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" /> Cart Total Updated
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
            <span>
              One or more product prices in your cart were updated recently.
            </span>
            <span className="block font-semibold text-slate-900 text-sm mt-1">
              New Total: ${Number(newTotal).toFixed(2)}
            </span>
            <span className="block mt-1">
              Would you like to proceed with the updated total?
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Return to Cart
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onAccept}
            className="bg-[#007BFF] hover:bg-blue-600 text-white"
          >
            Accept and Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PriceChangedModal;
