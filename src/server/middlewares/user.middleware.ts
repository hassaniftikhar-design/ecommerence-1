import type { UpdateAddressPayload } from '@/types/user.types';

import { type ValidationResult } from './validation.middleware';

export function validateUpdateUserAddressInput(
  body: unknown
): ValidationResult<UpdateAddressPayload> {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      status: 400,
      errors: ['Request body must be an object'],
      message: 'Invalid address payload'
    };
  }

  const { addressLine, city, postalCode, country, phone, name } = body as Record<string, unknown>;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return {
      success: false,
      status: 400,
      errors: ['name cannot be empty'],
      message: 'Full name cannot be empty'
    };
  }
  if (!addressLine || typeof addressLine !== 'string' || !addressLine.trim()) {
    return {
      success: false,
      status: 400,
      errors: ['addressLine is required'],
      message: 'Address line is required'
    };
  }
  if (!city || typeof city !== 'string' || !city.trim()) {
    return {
      success: false,
      status: 400,
      errors: ['city is required'],
      message: 'City is required'
    };
  }
  if (!postalCode || typeof postalCode !== 'string' || !postalCode.trim()) {
    return {
      success: false,
      status: 400,
      errors: ['postalCode is required'],
      message: 'Postal / Zip code is required'
    };
  }
  if (!country || typeof country !== 'string' || !country.trim()) {
    return {
      success: false,
      status: 400,
      errors: ['country is required'],
      message: 'Country is required'
    };
  }

  return {
    success: true,
    data: {
      addressLine: addressLine.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : undefined,
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined
    }
  };
}
