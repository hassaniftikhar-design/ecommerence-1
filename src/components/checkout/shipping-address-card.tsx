'use client';

import React, { useState } from 'react';

import {
  MapPin,
  Edit2,
  Check,
  Phone,
  AlertCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateUserAddress } from '@/services/user.service';
import type { UserAddress } from '@/types/user.types';

interface ShippingAddressCardProps {
  address: UserAddress | null;
  onAddressUpdated: (newAddress: UserAddress) => void;
  requiredError?: boolean;
}

export function ShippingAddressCard({
  address,
  onAddressUpdated,
  requiredError
}: ShippingAddressCardProps) {
  const hasExistingAddress = Boolean(
    address?.addressLine && address?.city && address?.postalCode && address?.country
  );

  const [isEditing, setIsEditing] = useState(!hasExistingAddress);
  const [formData, setFormData] = useState({
    addressLine: address?.addressLine || '',
    city: address?.city || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'United States',
    phone: address?.phone || ''
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state if address prop changes
  React.useEffect(() => {
    if (address) {
      setFormData({
        addressLine: address.addressLine || '',
        city: address.city || '',
        postalCode: address.postalCode || '',
        country: address.country || 'United States',
        phone: address.phone || ''
      });
      if (!address.addressLine || !address.city) {
        setIsEditing(true);
      }
    }
  }, [address]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.addressLine.trim()) {
      setFormError('Street address is required');
      return;
    }
    if (!formData.city.trim()) {
      setFormError('City is required');
      return;
    }
    if (!formData.postalCode.trim()) {
      setFormError('Postal / Zip code is required');
      return;
    }
    if (!formData.country.trim()) {
      setFormError('Country is required');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const updated = await updateUserAddress({
        addressLine: formData.addressLine.trim(),
        city: formData.city.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim(),
        phone: formData.phone.trim() || undefined
      });

      onAddressUpdated(updated);
      setIsEditing(false);
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-6 shadow-xs transition-all ${
        requiredError && !hasExistingAddress && !isEditing
          ? 'border-red-400 ring-2 ring-red-100'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#007BFF]">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Shipping & Delivery Address
            </h2>
            <p className="text-[11px] text-slate-500">
              Where should we deliver your order?
            </p>
          </div>
        </div>

        {hasExistingAddress && !isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-xs h-8 px-3 rounded-lg border-slate-200 text-[#007BFF] hover:bg-blue-50/50 flex items-center gap-1.5"
          >
            <Edit2 className="h-3 w-3" /> Change Address
          </Button>
        )}
      </div>

      {formError && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{formError}</span>
        </div>
      )}

      {requiredError && !hasExistingAddress && !isEditing && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span className="flex-1 leading-snug">
            Please provide a shipping address before completing your order.
          </span>
        </div>
      )}

      {/* READ VIEW */}
      {hasExistingAddress && !isEditing ? (
        <div className="rounded-xl bg-slate-50/60 p-4 border border-slate-100 flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">
                {address?.name || 'Customer'}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <Check className="h-2.5 w-2.5 mr-0.5" /> Verified
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              {address?.addressLine}
            </p>
            <p className="text-xs text-slate-500">
              {address?.city}, {address?.postalCode}, {address?.country}
            </p>
            {address?.phone && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                <Phone className="h-3 w-3 text-slate-400" /> {address.phone}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* EDIT / ADD FORM VIEW */
        <form onSubmit={handleSave} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Street Address <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.addressLine}
              onChange={(e) => handleChange('addressLine', e.target.value)}
              placeholder="e.g. 123 Main Street, Apt 4B"
              className="text-xs h-9 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g. New York"
                className="text-xs h-9 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Postal / Zip Code <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="e.g. 10001"
                className="text-xs h-9 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="e.g. United States"
                className="text-xs h-9 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone Number
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="e.g. +1 (555) 019-2834"
                className="text-xs h-9 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {hasExistingAddress && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="text-xs h-8 px-3 rounded-lg"
              >
                Cancel
              </Button>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-semibold h-8 px-4 rounded-lg shadow-xs"
            >
              {saving ? 'Saving Address...' : hasExistingAddress ? 'Update Address' : 'Save Shipping Address'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
