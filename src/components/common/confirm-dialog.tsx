'use client';

import type { ReactNode } from 'react';

import { TriangleAlert } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

// Generic "are you sure?" pattern (warning triangle + title +
// message + Cancel/Confirm) composed once here on top of the
// unstyled ui/alert-dialog primitives. "Remove Product" in the cart
// is its first use, but nothing about this component is cart-specific
// -- a future "Cancel Order" or "Delete Account" confirmation reuses
// it with different copy instead of duplicating this markup.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <TriangleAlert
          className="mx-auto mb-6 h-16 w-16 text-warning"
          aria-hidden="true"
        />
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <div className="flex gap-4">
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
