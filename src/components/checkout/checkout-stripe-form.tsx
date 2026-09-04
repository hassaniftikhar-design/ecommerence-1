'use client';

import React, { useState, useRef } from 'react';

import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { AlertCircle, Lock, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { createCheckoutIntent } from '@/services/payment.service';
import { getFriendlyPaymentErrorMessage } from '@/lib/stripe/errors';

import type { SavedPaymentMethod } from '@/types/payment.types';

import { SavedCardsSelector } from './saved-cards-selector';

interface CheckoutStripeFormProps {
  selectedItemIds: string[];
  totalAmount: number;
  savedCards: SavedPaymentMethod[];
  hasValidAddress?: boolean;
  onAddressMissing?: () => void;
  onOrderPlaced?: (orderId: string) => void;
  onPriceChanged?: (newTotal: number) => void;
  onOutOfStock?: (message: string) => void;
  onBackToInfo?: () => void;
}

export function CheckoutStripeForm({
  selectedItemIds,
  totalAmount,
  savedCards,
  hasValidAddress = true,
  onAddressMissing,
  onPriceChanged,
  onOutOfStock,
  onBackToInfo
}: CheckoutStripeFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const defaultCard = savedCards.find((c) => c.isDefault);
  const initialSelection = defaultCard ? defaultCard.id : (savedCards[0]?.id || 'new');

  const [selectedCardId, setSelectedCardId] = useState<string | 'new'>(initialSelection);
  const [saveCardForFuture, setSaveCardForFuture] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidAddress) {
      setErrorMessage('Please enter and save your shipping address to continue.');
      onAddressMissing?.();
      return;
    }

    if (!stripe) {
      setErrorMessage('Payment system is still initializing. Please wait a moment.');
      return;
    }

    if (selectedCardId === 'new' && !elements) {
      setErrorMessage('Please fill in your card details.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      // If entering a new card, validate Elements first
      if (selectedCardId === 'new' && elements) {
        const { error: submitError } = await elements.submit();
        if (submitError) {
          const { friendlyMessage } = getFriendlyPaymentErrorMessage(submitError);
          setErrorMessage(friendlyMessage);
          setLoading(false);
          return;
        }
      }

      // 1. Create PaymentIntent on the backend (atomically creates Order and reserves stock in DB first)
      const intentResponse = await createCheckoutIntent({
        itemIds: selectedItemIds,
        expectedTotal: totalAmount,
        savedPaymentMethodId: selectedCardId !== 'new' ? selectedCardId : undefined,
        saveCardForFuture: selectedCardId === 'new' ? saveCardForFuture : false,
        idempotencyKey: idempotencyKeyRef.current
      });

      const { clientSecret, orderId } = intentResponse;

      // 2. Confirm Payment with Stripe
      const returnUrl = `${window.location.origin}/orders/${orderId}/payment-status`;

      let confirmResult;
      if (selectedCardId === 'new' && elements) {
        confirmResult = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: returnUrl
          }
        });
      } else {
        // Confirming with existing saved card
        confirmResult = await stripe.confirmPayment({
          clientSecret,
          confirmParams: {
            return_url: returnUrl
          }
        });
      }

      if (confirmResult.error) {
        const { friendlyMessage } = getFriendlyPaymentErrorMessage(confirmResult.error);
        setErrorMessage(friendlyMessage);
      }
    } catch (err: unknown) {
      const errorObj = err as { errors?: string[]; data?: { newTotal?: number }; message?: string };
      if (errorObj?.errors?.includes?.('PRICE_CHANGED') && errorObj?.data?.newTotal) {
        onPriceChanged?.(errorObj.data.newTotal);
        return;
      }
      if (errorObj?.errors?.includes?.('OUT_OF_STOCK') || errorObj?.message?.toLowerCase()?.includes('out of stock')) {
        onOutOfStock?.(errorObj.message || 'An item in your cart is currently out of stock. Please update your cart quantity.');
        return;
      }
      const { friendlyMessage } = getFriendlyPaymentErrorMessage(err);
      setErrorMessage(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Saved Cards or Add New Selection */}
      <SavedCardsSelector
        savedCards={savedCards}
        selectedCardId={selectedCardId}
        onSelect={(id) => {
          setSelectedCardId(id);
          setErrorMessage(null);
        }}
        disabled={loading}
      />

      {/* Stripe Payment Element (Shown when "new" card is selected) */}
      {selectedCardId === 'new' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Card Information
            </span>
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" /> 256-bit SSL Encrypted
            </span>
          </div>

          <div className="pt-1">
            <PaymentElement
              options={{
                layout: 'tabs'
              }}
            />
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <Checkbox
              id="saveCard"
              checked={saveCardForFuture}
              onCheckedChange={(checked) => setSaveCardForFuture(Boolean(checked))}
              disabled={loading}
            />
            <label
              htmlFor="saveCard"
              className="text-xs font-medium text-slate-700 cursor-pointer select-none"
            >
              Save this card securely for future purchases
            </label>
          </div>
        </div>
      )}

      {/* Security note */}
      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
        <Lock className="h-3 w-3 text-slate-400 shrink-0" />
        <span>Secured by Stripe. We never store your full card number.</span>
      </p>

      {/* Submit Button */}
      <div className="space-y-3 pt-1">
        <Button
          type="submit"
          disabled={loading || !stripe}
          className="w-full h-11 sm:h-12 bg-[#007BFF] hover:bg-blue-600 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing Payment...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Pay ${totalAmount.toFixed(2)} Securely
            </span>
          )}
        </Button>

        {onBackToInfo && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onBackToInfo}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Back to Delivery Info
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
