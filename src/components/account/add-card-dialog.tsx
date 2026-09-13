'use client';

import React, { useState, useEffect } from 'react';

import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

import { AlertCircle, CreditCard, Lock, ShieldCheck } from 'lucide-react';

import { getStripe } from '@/lib/stripe/stripe-client';
import {
  getSetupIntentSecret,
  savePaymentMethod
} from '@/services/payment.service';
import { getFriendlyPaymentErrorMessage } from '@/lib/stripe/errors';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription
} from '@/components/ui/alert-dialog';
import type { SavedPaymentMethod } from '@/types/payment.types';

interface AddCardFormProps {
  onSuccess: (card: SavedPaymentMethod) => void;
  onCancel: () => void;
}

function AddCardForm({ onSuccess, onCancel }: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [setAsDefault, setSetAsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Validate Elements form
      const { error: submitError } = await elements.submit();
      if (submitError) {
        const { friendlyMessage } = getFriendlyPaymentErrorMessage(submitError);
        setError(friendlyMessage);
        setLoading(false);
        return;
      }

      // Confirm SetupIntent on Stripe
      const result = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/account/payment-methods`
        }
      });

      if (result.error) {
        const { friendlyMessage } = getFriendlyPaymentErrorMessage(result.error);
        setError(friendlyMessage);
        return;
      }

      const paymentMethodId =
        typeof result.setupIntent?.payment_method === 'string'
          ? result.setupIntent.payment_method
          : result.setupIntent?.payment_method?.id;

      if (!paymentMethodId) {
        throw new Error('Could not retrieve payment method from setup intent');
      }

      // Save locally in database
      const saved = await savePaymentMethod(paymentMethodId, setAsDefault);
      onSuccess(saved);
    } catch (err: unknown) {
      const { friendlyMessage } = getFriendlyPaymentErrorMessage(err);
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <PaymentElement
          options={{
            layout: 'accordion',
            wallets: {
              link: 'never',
              applePay: 'never',
              googlePay: 'never'
            }
          }}
        />
      </div>

      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="setAsDefaultCheckbox"
          checked={setAsDefault}
          onCheckedChange={(checked) => setSetAsDefault(Boolean(checked))}
          disabled={loading}
        />
        <label
          htmlFor="setAsDefaultCheckbox"
          className="text-xs font-medium text-slate-700 cursor-pointer select-none"
        >
          Set as default payment method
        </label>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <span className="flex items-center gap-1 text-emerald-600">
          <ShieldCheck className="h-3.5 w-3.5" /> Encrypted & Secure
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> Powered by Stripe
        </span>
      </div>

      <div className="flex justify-end gap-2.5 pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="text-xs h-9 px-4 rounded-lg"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !stripe}
          className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-semibold h-9 px-5 rounded-lg shadow-sm"
        >
          {loading ? 'Saving Card...' : 'Save Card'}
        </Button>
      </div>
    </form>
  );
}

interface AddCardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCardAdded: (card: SavedPaymentMethod) => void;
}

export function AddCardDialog({
  isOpen,
  onClose,
  onCardAdded
}: AddCardDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const stripePromise = getStripe();

  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null);
      setInitError(null);
      return;
    }

    async function initSetupIntent() {
      try {
        setLoadingSecret(true);
        setInitError(null);
        const secret = await getSetupIntentSecret();
        setClientSecret(secret);
      } catch (err: unknown) {
        setInitError((err as Error).message || 'Failed to initialize payment form');
      } finally {
        setLoadingSecret(false);
      }
    }

    initSetupIntent();
  }, [isOpen]);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CreditCard className="h-5 w-5 text-[#007BFF]" /> Add Payment Method
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-500">
            Enter your card information. Your card details are securely stored via Stripe.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loadingSecret && (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007BFF] border-t-transparent mb-2" />
            <p>Initializing secure card form...</p>
          </div>
        )}

        {initError && (
          <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200">
            {initError}
          </div>
        )}

        {clientSecret && !loadingSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#007BFF',
                  borderRadius: '8px'
                }
              }
            }}
          >
            <AddCardForm
              onSuccess={(card) => {
                onCardAdded(card);
                onClose();
              }}
              onCancel={onClose}
            />
          </Elements>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
