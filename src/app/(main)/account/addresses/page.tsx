'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { useSession } from 'next-auth/react';
import { AlertCircle } from 'lucide-react';

import { BackHeading } from '@/components/common/back-heading';
import { ShippingAddressCard } from '@/components/checkout/shipping-address-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { getUserAddress } from '@/services/user.service';
import { ROUTES } from '@/constants/routes';
import type { UserAddress } from '@/types/user.types';

export default function AddressesPage() {
  const { status } = useSession();
  const { showSuccess } = useToast();

  const [address, setAddress] = useState<UserAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddress = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      setLoading(true);
      setError(null);
      const data = await getUserAddress();
      setAddress(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load address');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAddress();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchAddress]);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-6">
      <BackHeading title="Shipping Address" href={ROUTES.home} />

      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Delivery Address
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manage your primary shipping address for accurate deliveries.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <div className="max-w-2xl">
          <ShippingAddressCard
            address={address}
            onAddressUpdated={(newAddr) => {
              setAddress(newAddr);
              showSuccess('Address updated successfully');
            }}
          />
        </div>
      )}
    </div>
  );
}
