import type { ValidationResult } from './validation.middleware';

export interface ResolveImportItemInput {
  jobId: string;
  productId?: string;
}

export function validateResolveImportItemInput(
  itemId: unknown,
  body: unknown
): ValidationResult<ResolveImportItemInput & { itemId: string }> {
  if (typeof itemId !== 'string' || !itemId.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Missing import item ID'
    };
  }

  const payload = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const jobId = typeof payload.jobId === 'string' ? payload.jobId.trim() : '';

  if (!jobId) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Missing jobId parameter'
    };
  }

  const productId = typeof payload.productId === 'string' ? payload.productId.trim() : undefined;

  return {
    success: true,
    data: {
      itemId: itemId.trim(),
      jobId,
      productId
    }
  };
}

export function validateImportJobIdInput(jobId: unknown): ValidationResult<string> {
  if (typeof jobId !== 'string' || !jobId.trim()) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Missing import job ID'
    };
  }
  return {
    success: true,
    data: jobId.trim()
  };
}

export function validateBulkImportFileInput(file: unknown): ValidationResult<File> {
  if (!file || !(file instanceof File)) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Please provide a valid CSV or XLSX product file'
    };
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'Invalid file type. Only .csv and .xlsx files are supported.'
    };
  }

  return {
    success: true,
    data: file
  };
}

export function validateBulkImportJsonInput(products: unknown): ValidationResult<unknown[]> {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      success: false,
      status: 400,
      errors: [],
      message: 'No products provided for bulk import'
    };
  }
  return {
    success: true,
    data: products
  };
}
