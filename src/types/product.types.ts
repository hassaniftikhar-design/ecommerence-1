import type { Prisma } from '@prisma/client';

export interface ProductOptionValue {
  id: string;
  optionId: string;
  value: string;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;
  values: ProductOptionValue[];
}

export interface VariantOptionInfo {
  optionName: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  stock: number;
  images: string[];
  attributes?: Record<string, string>;
  variantOptions?: VariantOptionInfo[];
  createdAt: string;
  updatedAt: string;
}

export type ProductStatusFilter = 'all' | 'active' | 'inactive' | 'errors';

export interface ProductImportErrorInfo {
  itemId: string;
  jobId: string;
  errorMessage?: string;
  errorType?: string;
}

export interface Product {
  id: string;
  productCode?: string | null;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl: string;
  isActive: boolean;
  inactiveAt?: string | null;
  category: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
  } | null;
  options: ProductOption[];
  variants: ProductVariant[];

  // Computed / Metadata fields
  lowestPrice?: number;
  totalStock?: number;
  variantCount?: number;
  importError?: ProductImportErrorInfo | null;

  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantItem {
  id?: string;
  color: string;
  size: string;
  quantity: number;
}

export interface ProductFormValues {
  name: string;
  description?: string;
  categoryName: string;
  price: number;
  imageUrl?: string;
  variants: ProductVariantItem[];
}

export interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: Product;
  onSubmitSuccess?: (savedProduct?: Product) => void | Promise<void>;
}

export interface RawImportVariant {
  sku?: string;
  stock?: number | string;
  images?: string[];
  attributes?: Record<string, string>;
  original_image_path?: string;
}

export interface RawImportOption {
  name: string;
  values?: string[];
}

export interface RawImportProductData {
  name?: string;
  title?: string;
  productCode?: string;
  price?: number | string;
  stock?: number | string;
  categoryId?: string;
  categoryName?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  options?: RawImportOption[];
  variants?: RawImportVariant[];
}

export interface ImportErrorItemReview {
  id: string;
  row_index: number;
  product_id?: string | null;
  raw_data?: RawImportProductData;
  error_type?: string;
  error_message?: string;
  resolution_status?: 'PENDING' | 'RESOLVED';
}

export interface AdminProductFormPageProps {
  productId?: string;
}

export interface RawVariantOption {
  optionValue: {
    value: string;
    option: {
      name: string;
    };
  };
}

export interface RawVariant {
  id: string;
  productId: string;
  sku: string;
  stock: number;
  images: string[];
  variantOptions?: RawVariantOption[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RawProductOptionValue {
  id: string;
  optionId: string;
  value: string;
}

export interface RawProductOption {
  id: string;
  productId: string;
  name: string;
  values?: RawProductOptionValue[];
}

export interface RawProduct {
  id: string;
  productCode?: string | null;
  name: string;
  description?: string | null;
  price: Prisma.Decimal | number;
  isActive: boolean;
  inactiveAt?: Date | string | null;
  category?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  options?: RawProductOption[];
  variants?: RawVariant[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GetProductsServerParams {
  searchQuery?: string;
  categoryQuery?: string;
  sortQuery?: string;
  statusQuery?: string;
  pageNumber?: number;
  limitNumber?: number;
  isPaginatedCall?: boolean;
  userIsAdmin?: boolean;
}

export interface NormalizedUpdateVariant {
  id?: string;
  sku: string;
  price?: number;
  stock: number;
  images?: string[];
  attributes?: Record<string, string>;
  matchedExistingId?: string;
}

export interface ImportJobErrorItem {
  id?: string;
  row_index: number;
  product_name?: string;
  error_type?: string;
  error: string;
  product_id?: string;
  resolution_status?: string;
  resolved_at?: string;
  raw_data?: RawImportProductData;
}

export interface ImportJobStatus {
  id: string;
  filename?: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  errors: ImportJobErrorItem[];
}

export interface ResolveImportItemResponse {
  success: boolean;
  message: string;
  item_id: string;
  resolution_status: string;
  product_id?: string | null;
}

export interface SchedulerEnqueueResponse {
  task_id: string;
  status: string;
  message: string;
}
