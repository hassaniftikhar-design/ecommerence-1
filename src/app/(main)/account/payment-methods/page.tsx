'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { useSession } from 'next-auth/react';
import {
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Star
} from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  getSavedPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod
} from '@/services/payment.service';
import { AddCardDialog } from '@/components/account/add-card-dialog';
import { useToast } from '@/components/ui/toast';
import { ROUTES } from '@/constants/routes';
import type { SavedPaymentMethod } from '@/types/payment.types';

function formatBrandName(brand: string): string {
  const b = brand.toLowerCase();
  if (b === 'visa') return 'Visa';
  if (b === 'mastercard') return 'Mastercard';
  if (b === 'amex' || b === 'american express') return 'American Express';
  if (b === 'discover') return 'Discover';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function PaymentMethodsPage() {
  const { status } = useSession();
  const { showSuccess, showError } = useToast();

  const [cards, setCards] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      setLoading(true);
      setError(null);
      const data = await getSavedPaymentMethods();
      setCards(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCards();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchCards]);

  const handleSetDefault = async (cardId: string) => {
    try {
      setActionLoading(true);
      await setDefaultPaymentMethod(cardId);
      showSuccess('Default payment method updated');
      setCards((prev) =>
        prev.map((c) => ({
          ...c,
          isDefault: c.id === cardId
        }))
      );
    } catch (err: unknown) {
      showError((err as Error).message || 'Failed to update default card');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!deletingCardId) return;
    try {
      setActionLoading(true);
      await deletePaymentMethod(deletingCardId);
      showSuccess('Payment method deleted');
      setDeletingCardId(null);
      fetchCards();
    } catch (err: unknown) {
      showError((err as Error).message || 'Failed to delete card');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-6">
      <BackHeading title="Payment Methods" href={ROUTES.home} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Saved Payment Cards
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your saved cards for fast and secure checkout.
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-xs flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Payment Method
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#007BFF]">
            <CreditCard className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No payment methods saved</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add a credit or debit card now to make future purchases seamless and secure.
            </p>
          </div>
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-semibold h-9 px-5 rounded-xl shadow-xs"
          >
            Add Your First Card
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {formatBrandName(card.brand)}
                      </span>
                      {card.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#007BFF]">
                          <CheckCircle2 className="h-3 w-3" /> DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">
                      •••• •••• •••• {card.last4}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDeletingCardId(card.id)}
                  disabled={actionLoading}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete card"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}</span>

                {!card.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(card.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 font-semibold text-[#007BFF] hover:underline cursor-pointer"
                  >
                    <Star className="h-3.5 w-3.5" /> Make Default
                  </button>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Default method</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Card Modal */}
      <AddCardDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCardAdded={() => {
          showSuccess('New card added successfully');
          fetchCards();
        }}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(deletingCardId)}
        onOpenChange={(open) => !open && setDeletingCardId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this card? This action will detach the card from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteCard();
              }}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {actionLoading ? 'Removing...' : 'Remove Card'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
