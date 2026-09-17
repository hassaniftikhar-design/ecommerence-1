import {
  getColorCode,
  getSizeCode,
  normalizeSku,
  generateProductCode,
  generateDefaultSku,
  extractProductCodePrefix,
  formatProductCode,
  replaceSkuProductCode
} from '@/lib/sku-util';
import {
  productFormSchema,
  createProductSchema,
  updateProductSchema
} from '@/lib/validators';

describe('SKU Utilities (sku-util)', () => {
  it('generates 3-letter uppercase color codes correctly', () => {
    expect(getColorCode('Green')).toBe('GRN');
    expect(getColorCode('Beige')).toBe('BEI');
    expect(getColorCode('Gray')).toBe('GRY');
    expect(getColorCode('Black')).toBe('BLK');
    expect(getColorCode('White')).toBe('WHT');
    expect(getColorCode('Blue')).toBe('BLU');
    expect(getColorCode('Red')).toBe('RED');
    expect(getColorCode('Navy')).toBe('NAV');
    expect(getColorCode('Yellow')).toBe('YEL');
    expect(getColorCode('Orange')).toBe('ORA');
    expect(getColorCode('Pink')).toBe('PNK');
    expect(getColorCode('Purple')).toBe('PUR');
    expect(getColorCode('Brown')).toBe('BRW');
    expect(getColorCode('Gold')).toBe('GLD');
    expect(getColorCode('Silver')).toBe('SLV');
    expect(getColorCode('Charcoal')).toBe('CHR');
    expect(getColorCode('Olive')).toBe('OLV');
    expect(getColorCode('Teal')).toBe('TEA');
    expect(getColorCode('Maroon')).toBe('MAR');
    expect(getColorCode('Coral')).toBe('COR');
    expect(getColorCode('Lavender')).toBe('LAV');
    expect(getColorCode('Burgundy')).toBe('BUR');
    expect(getColorCode('Mint')).toBe('MNT');
    expect(getColorCode('Rose')).toBe('ROS');
    expect(getColorCode('Cream')).toBe('CRM');
    expect(getColorCode('Khaki')).toBe('KHK');
  });

  it('generates uppercase size codes correctly', () => {
    expect(getSizeCode('XS')).toBe('XS');
    expect(getSizeCode('S')).toBe('S');
    expect(getSizeCode('M')).toBe('M');
    expect(getSizeCode('L')).toBe('L');
    expect(getSizeCode('XL')).toBe('XL');
    expect(getSizeCode('XXL')).toBe('XXL');
    expect(getSizeCode('2XL')).toBe('2XL');
    expect(getSizeCode('3XL')).toBe('3XL');
    expect(getSizeCode('Small')).toBe('S');
    expect(getSizeCode('Medium')).toBe('M');
    expect(getSizeCode('Large')).toBe('L');
  });

  it('normalizes SKUs to trimmed uppercase', () => {
    expect(normalizeSku('  brac-001-grn-s  ')).toBe('BRAC-001-GRN-S');
    expect(normalizeSku('sku-test-123')).toBe('SKU-TEST-123');
    expect(normalizeSku('')).toBe('');
    expect(normalizeSku(undefined)).toBe('');
  });

  it('generates clean product codes taking the first 4 characters of title', () => {
    expect(generateProductCode('Grip Socks', 'Accessories')).toBe('GRIP-001');
    expect(generateProductCode('Silver Bracelet', 'Jewelry')).toBe('SILV-001');
    expect(generateProductCode('Leather Jacket', 'Apparel')).toBe('LEAT-001');
    expect(generateProductCode('T-Shirt', 'Apparel')).toBe('TSHI-001');
    expect(generateProductCode('Cap', 'Accessories')).toBe('CAP-001');
  });

  it('generates exact default SKUs following PRODUCT_CODE-COLOR_CODE-SIZE_CODE format', () => {
    const prodCode = 'BRAC-001';
    expect(generateDefaultSku(prodCode, 'Green', 'S')).toBe('BRAC-001-GRN-S');
    expect(generateDefaultSku(prodCode, 'Beige', 'S')).toBe('BRAC-001-BEI-S');
    expect(generateDefaultSku(prodCode, 'Gray', 'S')).toBe('BRAC-001-GRY-S');
    expect(generateDefaultSku(prodCode, 'Green', 'M')).toBe('BRAC-001-GRN-M');
    expect(generateDefaultSku(prodCode, 'Black', 'L')).toBe('BRAC-001-BLK-L');
    expect(generateDefaultSku(prodCode, 'White', 'XL')).toBe('BRAC-001-WHT-XL');
    expect(generateDefaultSku(prodCode)).toBe('BRAC-001-DEF');
  });

  it('extracts prefixes and formats sequential product codes correctly', () => {
    expect(extractProductCodePrefix('Counter Hand Gripper')).toBe('COUN');
    expect(extractProductCodePrefix('Silver Bracelet')).toBe('SILV');
    expect(extractProductCodePrefix('T-Shirt')).toBe('TSHI');
    expect(extractProductCodePrefix('Hi', 'Electronics')).toBe('ELEC');
    expect(formatProductCode('COUN', 1)).toBe('COUN-001');
    expect(formatProductCode('COUN', 2)).toBe('COUN-002');
    expect(formatProductCode('COUN', 15)).toBe('COUN-015');
  });

  it('replaces SKU product code prefix while preserving color and size suffix', () => {
    expect(replaceSkuProductCode('COUN-001-BLK-M', 'COUN-002')).toBe('COUN-002-BLK-M');
    expect(replaceSkuProductCode('COUN-001-WHT-L', 'COUN-002')).toBe('COUN-002-WHT-L');
    expect(replaceSkuProductCode('COUN-001-DEF', 'COUN-002')).toBe('COUN-002-DEF');
    expect(replaceSkuProductCode('SILV-001-SLV-S', 'SILV-003')).toBe('SILV-003-SLV-S');
  });
});

describe('SKU Validation in Schemas (validators)', () => {
  it('validates and accepts valid productFormSchema with unique SKUs', () => {
    const validData = {
      name: 'Leather Jacket',
      productCode: 'JACK-001',
      categoryName: 'Apparel',
      price: 199.99,
      defaultImageUrl: 'https://example.com/jacket.jpg',
      variants: [
        {
          sku: 'JACK-001-BLK-M',
          color: 'Black',
          size: 'M',
          quantity: 10
        },
        {
          sku: 'JACK-001-BLK-L',
          color: 'Black',
          size: 'L',
          quantity: 15
        },
        {
          sku: 'JACK-001-BRW-M',
          color: 'Brown',
          size: 'M',
          quantity: 5
        }
      ]
    };

    const result = productFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects duplicate SKUs within the same form submission', () => {
    const duplicateSkuData = {
      name: 'Leather Jacket',
      productCode: 'JACK-001',
      categoryName: 'Apparel',
      price: 199.99,
      defaultImageUrl: 'https://example.com/jacket.jpg',
      variants: [
        {
          sku: 'JACK-001-BLK-M',
          color: 'Black',
          size: 'M',
          quantity: 10
        },
        {
          sku: 'jack-001-blk-m', // Same SKU case-insensitively
          color: 'Brown',
          size: 'L',
          quantity: 15
        }
      ]
    };

    const result = productFormSchema.safeParse(duplicateSkuData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMsg = result.error.errors.map((e) => e.message).join(' ');
      expect(errorMsg).toContain('Duplicate SKU');
    }
  });

  it('rejects empty or whitespace SKUs in variants', () => {
    const emptySkuData = {
      name: 'Leather Jacket',
      productCode: 'JACK-001',
      categoryName: 'Apparel',
      price: 199.99,
      defaultImageUrl: 'https://example.com/jacket.jpg',
      variants: [
        {
          sku: '   ',
          color: 'Black',
          size: 'M',
          quantity: 10
        }
      ]
    };

    const result = productFormSchema.safeParse(emptySkuData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMsg = result.error.errors.map((e) => e.message).join(' ');
      expect(errorMsg.toLowerCase()).toContain('sku is required');
    }
  });

  it('validates createProductSchema and updateProductSchema with productCode', () => {
    const createData = {
      name: 'Modern Lamp',
      productCode: 'LAMP-001',
      categoryName: 'Home',
      price: 49.99,
      stock: 20
    };
    const createResult = createProductSchema.safeParse(createData);
    expect(createResult.success).toBe(true);

    const updateData = {
      name: 'Updated Lamp',
      productCode: 'LAMP-002'
    };
    const updateResult = updateProductSchema.safeParse(updateData);
    expect(updateResult.success).toBe(true);
  });

  it('rejects zero or negative or invalid price in productFormSchema', () => {
    const zeroPriceData = {
      name: 'Leather Jacket',
      productCode: 'JACK-001',
      categoryName: 'Apparel',
      price: 0,
      defaultImageUrl: 'https://example.com/jacket.jpg',
      variants: [
        {
          sku: 'JACK-001-BLK-M',
          color: 'Black',
          size: 'M',
          quantity: 10
        }
      ]
    };
    const zeroResult = productFormSchema.safeParse(zeroPriceData);
    expect(zeroResult.success).toBe(false);
    if (!zeroResult.success) {
      expect(zeroResult.error.errors.some((e) => e.message.includes('Price is required and must be greater than 0'))).toBe(true);
    }

    const negativePriceData = { ...zeroPriceData, price: -10 };
    const negResult = productFormSchema.safeParse(negativePriceData);
    expect(negResult.success).toBe(false);
  });
});
