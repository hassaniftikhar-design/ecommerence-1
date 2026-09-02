import { Decimal } from '@prisma/client/runtime/library';

export const MOCK_CATEGORY_ID = 'category-cuid-1';
export const MOCK_PRODUCT_ID = 'product-cuid-1';
export const MOCK_VARIANT_ID = 'variant-cuid-1';

export const mockCategory = {
  id: MOCK_CATEGORY_ID,
  name: 'Electronics'
};

export const mockCategoriesList = [
  mockCategory,
  { id: 'category-cuid-2', name: 'Fashion' },
  { id: 'category-cuid-3', name: 'Home & Garden' }
];

export const mockVariant = {
  id: MOCK_VARIANT_ID,
  productId: MOCK_PRODUCT_ID,
  sku: 'ELEC-PROD-1-RED-M',
  stock: 15,
  images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  variantOptions: [
    {
      id: 'vo-1',
      variantId: MOCK_VARIANT_ID,
      optionValueId: 'val-1',
      optionValue: {
        id: 'val-1',
        optionId: 'opt-1',
        value: 'Red',
        option: { id: 'opt-1', name: 'Color', productId: MOCK_PRODUCT_ID }
      }
    },
    {
      id: 'vo-2',
      variantId: MOCK_VARIANT_ID,
      optionValueId: 'val-2',
      optionValue: {
        id: 'val-2',
        optionId: 'opt-2',
        value: 'M',
        option: { id: 'opt-2', name: 'Size', productId: MOCK_PRODUCT_ID }
      }
    }
  ]
};

export const mockProduct = {
  id: MOCK_PRODUCT_ID,
  name: 'Wireless Noise Cancelling Headphones',
  description: 'High quality wireless headphones with active noise cancellation.',
  price: new Decimal(99.99),
  categoryId: MOCK_CATEGORY_ID,
  createdById: 'admin-cuid-67890',
  isActive: true,
  inactiveAt: null as Date | null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  category: mockCategory,
  createdBy: {
    id: 'admin-cuid-67890',
    name: 'Admin User'
  },
  options: [
    {
      id: 'opt-1',
      productId: MOCK_PRODUCT_ID,
      name: 'Color',
      values: [{ id: 'val-1', optionId: 'opt-1', value: 'Red' }]
    }
  ],
  variants: [mockVariant]
};

export const mockInactiveProduct = {
  ...mockProduct,
  id: 'product-inactive-cuid',
  name: 'Inactive Old Headphones',
  isActive: false,
  inactiveAt: new Date('2026-01-02T00:00:00Z')
};

export const mockCreateProductPayload = {
  name: 'Wireless Noise Cancelling Headphones',
  description: 'High quality wireless headphones',
  price: 99.99,
  categoryId: MOCK_CATEGORY_ID,
  options: [
    {
      name: 'Color',
      values: ['Red', 'Blue']
    }
  ],
  variants: [
    {
      sku: 'PROD-RED',
      stock: 10,
      images: ['https://example.com/image.jpg'],
      options: { Color: 'Red' }
    }
  ]
};
