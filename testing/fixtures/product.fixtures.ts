import { Decimal } from '@prisma/client/runtime/library';

export const TEST_CATEGORY_ID = 'category_test_1';
export const TEST_PRODUCT_1_ID = 'product_test_1';
export const TEST_PRODUCT_2_ID = 'product_test_2';
export const TEST_PRODUCT_INACTIVE_ID = 'product_test_inactive';
export const TEST_VARIANT_1_ID = 'variant_test_1';
export const TEST_VARIANT_2_ID = 'variant_test_2';
export const TEST_VARIANT_OUT_OF_STOCK_ID = 'variant_test_oos';

export const mockTestCategory = {
  id: TEST_CATEGORY_ID,
  name: 'Electronics'
};

export const mockTestVariant1 = {
  id: TEST_VARIANT_1_ID,
  productId: TEST_PRODUCT_1_ID,
  sku: 'TEST-PROD-1-BLACK',
  stock: 10,
  images: ['https://example.com/test-prod-1.jpg'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  variantOptions: [
    {
      id: 'vo_test_1',
      variantId: TEST_VARIANT_1_ID,
      optionValueId: 'val_test_1',
      optionValue: {
        id: 'val_test_1',
        optionId: 'opt_test_1',
        value: 'Black',
        option: { id: 'opt_test_1', name: 'Color', productId: TEST_PRODUCT_1_ID }
      }
    }
  ]
};

export const mockTestVariant2 = {
  id: TEST_VARIANT_2_ID,
  productId: TEST_PRODUCT_2_ID,
  sku: 'TEST-PROD-2-SILVER',
  stock: 5,
  images: ['https://example.com/test-prod-2.jpg'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  variantOptions: []
};

export const mockTestVariantOutOfStock = {
  id: TEST_VARIANT_OUT_OF_STOCK_ID,
  productId: TEST_PRODUCT_1_ID,
  sku: 'TEST-PROD-1-OOS',
  stock: 0,
  images: ['https://example.com/test-prod-oos.jpg'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  variantOptions: []
};

export const mockTestProduct1 = {
  id: TEST_PRODUCT_1_ID,
  name: 'Premium Headphones',
  description: 'High end noise canceling headphones',
  price: new Decimal(100.00),
  categoryId: TEST_CATEGORY_ID,
  createdById: 'admin_test_1',
  isActive: true,
  inactiveAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  category: mockTestCategory,
  options: [],
  variants: [mockTestVariant1]
};

export const mockTestProduct2 = {
  id: TEST_PRODUCT_2_ID,
  name: 'Wireless Mouse',
  description: 'Ergonomic wireless mouse',
  price: new Decimal(50.00),
  categoryId: TEST_CATEGORY_ID,
  createdById: 'admin_test_1',
  isActive: true,
  inactiveAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  category: mockTestCategory,
  options: [],
  variants: [mockTestVariant2]
};

export const mockTestInactiveProduct = {
  ...mockTestProduct1,
  id: TEST_PRODUCT_INACTIVE_ID,
  name: 'Discontinued Item',
  isActive: false,
  inactiveAt: new Date('2026-01-02T00:00:00Z')
};
