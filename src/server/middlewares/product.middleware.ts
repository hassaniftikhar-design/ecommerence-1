import { createProductSchema, updateProductSchema } from '@/lib/validators';

import { validateWithSchema, type ValidationResult } from './validation.middleware';

export function validateCreateProductInput(body: unknown) {
  return validateWithSchema(createProductSchema, body);
}

export function validateUpdateProductInput(body: unknown) {
  return validateWithSchema(updateProductSchema, body);
}

export function validateProductStatusInput(status: unknown): ValidationResult<boolean> {
  if (typeof status !== 'boolean') {
    return {
      success: false,
      status: 400,
      errors: ['isActive boolean field is required'],
      message: 'Validation failed'
    };
  }
  return {
    success: true,
    data: status
  };
}

export function validateProductIdInput(id: unknown): ValidationResult<string> {
  if (typeof id !== 'string' || !id.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Product ID is required'
    };
  }
  return {
    success: true,
    data: id.trim()
  };
}
