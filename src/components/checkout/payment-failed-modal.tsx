'use client';

import React from 'react';

import { XCircle, RotateCcw, Clock } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface PaymentFailedModalProps {
  isOpen: boolean;
  orderId?: string;
  orderNumber?: string;
  errorMessage?: string;
  onRetryNow: () => void;
  onPayLater: () => void;
}

export function PaymentFailedModal({
  isOpen,
  orderNumber,
  errorMessage,
  onRetryNow,
  onPayLater
}: PaymentFailedModalProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md p-6 rounded-2xl">
        <AlertDialogHeader className="space-y-3 text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
            <XCircle className="h-6 w-6" />
          </div>

          <AlertDialogTitle className="text-xl font-bold text-slate-900">
            Payment Unsuccessful
          </AlertDialogTitle>

          <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
            <span className="block">
              We were unable to process your payment
              {orderNumber ? ` for Order #${orderNumber}` : ''}. Your order has been saved and items remain reserved.
            </span>

            {errorMessage && (
              <span className="block rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200 mt-2 text-left">
                {errorMessage}
              </span>
            )}

            <span className="block text-slate-500 pt-1">
              You can try paying again now with another card, or pay later from your order details page.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2.5 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onPayLater}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Clock className="h-4 w-4 text-slate-500" /> Pay Later
          </Button>

          <Button
            type="button"
            onClick={onRetryNow}
            className="bg-[#007BFF] hover:bg-blue-600 text-white font-bold h-10 px-5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" /> Try Repayment Now
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PaymentFailedModal;
