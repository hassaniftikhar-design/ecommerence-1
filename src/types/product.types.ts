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
  price: number;
  stock: number;
  images: string[];
  attributes?: Record<string, string>;
  variantOptions?: VariantOptionInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl: string;
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
