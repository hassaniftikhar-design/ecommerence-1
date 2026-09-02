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

export type ProductStatusFilter = 'all' | 'active' | 'inactive';

export interface Product {
  id: string;
  name: string;
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
  };
  options: ProductOption[];
  variants: ProductVariant[];

  // Computed fields
  lowestPrice?: number;
  totalStock?: number;
  variantCount?: number;

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
  categoryName: string;
  price: number;
  imageUrl?: string;
  variants: ProductVariantItem[];
}

export interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: Product;
  onSubmitSuccess?: () => void;
}

