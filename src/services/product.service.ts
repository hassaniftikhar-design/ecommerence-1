import type { Product, ImportJobStatus } from '@/types/product.types';
import { PRODUCT_FETCH_BATCH_SIZE } from '@/constants/generalconstants';
import type { ApiResponse } from '@/lib/api-response';

async function parseApiResponse<T>(response: Response): Promise<T> {
  let json: ApiResponse<T> | null = null;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Server error (${response.status}). Please try again.`);
    }
  }

  if (!response.ok || (json && json.success === false)) {
    let errorMsg = '';

    const formattedErrors =
      json?.errors && Array.isArray(json.errors) && json.errors.length > 0
        ? json.errors
            .map((err) =>
              typeof err === 'string'
                ? err
                : (err as { message?: string })?.message || JSON.stringify(err)
            )
            .filter(Boolean)
            .join(', ')
        : '';

    if (json?.message && json.message !== 'Validation failed') {
      errorMsg = json.message;
    } else if (formattedErrors) {
      errorMsg = formattedErrors;
    } else if (json?.message) {
      errorMsg = json.message;
    }

    if (!errorMsg) {
      errorMsg = `Request failed (${response.status || 'Error'}). Please try again.`;
    }

    throw new Error(errorMsg);
  }

  return (json?.data ?? json) as T;
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await parseApiResponse<{ url: string }>(response);
  return data.url;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  sort?: string;
  status?: string;
}

export interface PaginatedProductsResponse {
  products: Product[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export async function getProducts(
  paramsOrQuery?: GetProductsParams | string,
  categoryArg?: string,
  sortArg?: string,
  statusArg?: string
): Promise<PaginatedProductsResponse> {
  let page = 1;
  let limit = PRODUCT_FETCH_BATCH_SIZE;
  let q = '';
  let category = '';
  let sort = '';
  let status = '';

  if (typeof paramsOrQuery === 'object' && paramsOrQuery !== null) {
    page = paramsOrQuery.page || 1;
    limit = paramsOrQuery.limit || PRODUCT_FETCH_BATCH_SIZE;
    q = paramsOrQuery.q || '';
    category = paramsOrQuery.category || '';
    sort = paramsOrQuery.sort || '';
    status = paramsOrQuery.status || '';
  } else {
    q = paramsOrQuery || '';
    category = categoryArg || '';
    sort = sortArg || '';
    status = statusArg || '';
  }

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));
  if (q) queryParams.set('q', q);
  if (category) queryParams.set('category', category);
  if (sort) queryParams.set('sort', sort);
  if (status) queryParams.set('status', status);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const response = await fetch(`/api/products${queryString}`, {
    cache: 'no-store'
  });
  const data = await parseApiResponse<{
    products: Product[];
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    pagination?: ProductsPaginationMeta;
  }>(response);

  const total = data.total ?? data.pagination?.totalItems ?? data.products.length;
  const pageNum = data.page ?? data.pagination?.page ?? page;
  const limitNum = data.limit ?? data.pagination?.limit ?? limit;
  const hasMore = data.hasMore ?? (pageNum * limitNum < total);

  return {
    products: data.products || [],
    page: pageNum,
    limit: limitNum,
    total,
    hasMore
  };
}

export interface ProductsPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface GetProductsPaginatedResult {
  products: Product[];
  pagination: ProductsPaginationMeta;
}

export async function getProductsPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  status?: string;
}): Promise<GetProductsPaginatedResult> {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.set('page', String(params.page));
  if (params.limit !== undefined) queryParams.set('limit', String(params.limit));
  if (params.search) queryParams.set('search', params.search);
  if (params.category) queryParams.set('category', params.category);
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.status) queryParams.set('status', params.status);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const response = await fetch(`/api/products${queryString}`, {
    cache: 'no-store'
  });
  const data = await parseApiResponse<{
    products: Product[];
    pagination: ProductsPaginationMeta;
  }>(response);

  return {
    products: data.products || [],
    pagination: data.pagination || {
      page: params.page || 1,
      limit: params.limit || 10,
      totalItems: data.products?.length || 0,
      totalPages: Math.ceil((data.products?.length || 0) / (params.limit || 10)) || 1,
      hasNextPage: false,
      hasPrevPage: false
    }
  };
}

export interface AdminDashboardStats {
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  validOrdersCount: number;
  activeProducts: number;
  ordersByStatus: {
    IN_PROGRESS: number;
    DISPATCHED: number;
    DELIVERED: number;
    REJECTED: number;
  };
}

let categoriesCache: { id: string; name: string }[] | null = null;
let categoriesPromise: Promise<{ id: string; name: string }[]> | null = null;

export function clearCategoriesCache() {
  categoriesCache = null;
}

export async function getCategories(): Promise<{ id: string; name: string }[]> {
  if (categoriesCache) {
    return categoriesCache;
  }

  if (categoriesPromise) {
    return categoriesPromise;
  }

  categoriesPromise = (async () => {
    try {
      const response = await fetch('/api/categories', {
        cache: 'no-store'
      });
      if (!response.ok) {
        return [];
      }
      const data = await parseApiResponse<{ categories: { id: string; name: string }[] }>(response);
      categoriesCache = data.categories;
      return data.categories;
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      return [];
    } finally {
      categoriesPromise = null;
    }
  })();

  return categoriesPromise;
}

export async function getProductById(id: string): Promise<Product> {
  const response = await fetch(`/api/products/${id}`, {
    cache: 'no-store'
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export interface CreateProductOptionInput {
  name: string;
  values: string[];
}

export interface CreateProductVariantInput {
  id?: string;
  sku?: string;
  price: number;
  stock: number;
  images?: string[];
  attributes?: Record<string, string>;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  productCode?: string;
  categoryId?: string;
  categoryName?: string;
  options?: CreateProductOptionInput[];
  variants?: CreateProductVariantInput[];
  // Single variant fallback fields
  price?: number;
  stock?: number;
  imageUrl?: string;
}

export async function createProduct(payload: CreateProductInput): Promise<Product> {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  clearCategoriesCache();
  return data.product;
}

export async function updateProduct(
  id: string,
  payload: Partial<CreateProductInput>
): Promise<Product> {
  const response = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  clearCategoriesCache();
  return data.product;
}

export async function activateProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/products/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true })
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export async function deactivateProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/products/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false })
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  await deactivateProduct(id);
}

export async function getImportJobStatus(jobId: string): Promise<ImportJobStatus> {
  const response = await fetch(`/api/admin/imports/${jobId}`, {
    cache: 'no-store'
  });
  return parseApiResponse<ImportJobStatus>(response);
}
