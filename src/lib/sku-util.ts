/**
 * SKU and Product Code generation, normalization, and abbreviation utilities.
 */

export const COLOR_CODE_MAP: Record<string, string> = {
  black: 'BLK',
  white: 'WHT',
  red: 'RED',
  blue: 'BLU',
  green: 'GRN',
  yellow: 'YEL',
  gray: 'GRY',
  grey: 'GRY',
  navy: 'NAV',
  'navy blue': 'NAV',
  brown: 'BRW',
  pink: 'PNK',
  purple: 'PUR',
  orange: 'ORA',
  beige: 'BEI',
  gold: 'GLD',
  silver: 'SLV',
  maroon: 'MAR',
  charcoal: 'CHR',
  olive: 'OLV',
  teal: 'TEA',
  coral: 'COR',
  lavender: 'LAV',
  burgundy: 'BUR',
  mint: 'MNT',
  rose: 'ROS',
  cream: 'CRM',
  khaki: 'KHK',
  cyan: 'CYN',
  indigo: 'IND'
};

export const SIZE_CODE_MAP: Record<string, string> = {
  xs: 'XS',
  'extra small': 'XS',
  s: 'S',
  small: 'S',
  m: 'M',
  medium: 'M',
  l: 'L',
  large: 'L',
  xl: 'XL',
  'extra large': 'XL',
  xxl: 'XXL',
  '2xl': '2XL',
  '3xl': '3XL',
  '4xl': '4XL',
  '5xl': '5XL'
};

/**
 * Returns standardized 3-letter uppercase color code.
 */
export function getColorCode(colorName?: string): string {
  if (!colorName || !colorName.trim()) return '';
  const clean = colorName.trim().toLowerCase();
  if (COLOR_CODE_MAP[clean]) {
    return COLOR_CODE_MAP[clean];
  }
  const alphanumeric = clean.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return alphanumeric.slice(0, 3) || 'CLR';
}

/**
 * Returns standardized uppercase size code.
 */
export function getSizeCode(sizeName?: string): string {
  if (!sizeName || !sizeName.trim()) return '';
  const clean = sizeName.trim().toLowerCase();
  if (SIZE_CODE_MAP[clean]) {
    return SIZE_CODE_MAP[clean];
  }
  return sizeName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalizes SKU string by trimming whitespace and converting to uppercase.
 */
export function normalizeSku(sku?: string): string {
  return (sku || '').trim().toUpperCase();
}

/**
 * Extracts 4-character uppercase alphanumeric prefix from title or category.
 */
export function extractProductCodePrefix(title?: string, categoryName?: string): string {
  let prefix = '';
  if (title && title.trim()) {
    const clean = title.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length >= 4) {
      prefix = clean.slice(0, 4);
    } else if (clean.length >= 3) {
      prefix = clean;
    }
  }

  if (!prefix && categoryName && categoryName.trim()) {
    const cleanCat = categoryName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    prefix = cleanCat.slice(0, 4) || 'PROD';
  }

  if (!prefix || prefix.length < 2) {
    prefix = 'PROD';
  }

  return prefix;
}

/**
 * Formats a prefix and integer sequence into a standardized Product Code (e.g., COUN-001, COUN-002).
 */
export function formatProductCode(prefix: string, sequence: number): string {
  const cleanPrefix = (prefix || 'PROD').trim().toUpperCase();
  const seqStr = String(Math.max(1, sequence)).padStart(3, '0');
  return `${cleanPrefix}-${seqStr}`;
}

/**
 * Generates a clean Product Code from the first 4 characters of the product title.
 * e.g. "Grip Socks" -> "GRIP-001"
 *      "Silver Bracelet" -> "SILV-001"
 *      "Leather Jacket" -> "LEAT-001"
 *      "T-Shirt" -> "TSHI-001"
 */
export function generateProductCode(title?: string, categoryName?: string): string {
  const prefix = extractProductCodePrefix(title, categoryName);
  return formatProductCode(prefix, 1);
}

/**
 * Replaces the productCode portion of an existing variant SKU with a new productCode,
 * while preserving color and size attribute suffixes.
 * e.g., replaceSkuProductCode("COUN-001-BLK-M", "COUN-002") -> "COUN-002-BLK-M"
 *       replaceSkuProductCode("COUN-001-DEF", "COUN-002") -> "COUN-002-DEF"
 */
export function replaceSkuProductCode(oldSku: string, newProductCode: string): string {
  const normSku = (oldSku || '').trim().toUpperCase();
  const cleanCode = (newProductCode || 'PROD-001').trim().toUpperCase();
  if (!normSku) {
    return `${cleanCode}-DEF`;
  }

  // Matches "PREFIX-NUM-SUFFIX" or "PREFIX-NUM" (e.g. COUN-001-BLK-M or COUN-001)
  const standardMatch = normSku.match(/^[A-Z0-9]+-[0-9]+(-.+)?$/i);
  if (standardMatch) {
    const suffix = standardMatch[1] || '';
    return `${cleanCode}${suffix}`;
  }

  // Matches "PREFIX-SUFFIX" (e.g. COUN-BLK-M)
  const prefixMatch = normSku.match(/^[A-Z0-9]+(-.+)$/i);
  if (prefixMatch) {
    return `${cleanCode}${prefixMatch[1]}`;
  }

  return `${cleanCode}-${normSku}`;
}

/**
 * Generates default variant SKU from productCode + color + size.
 * Formula: PRODUCT_CODE-COLOR_CODE-SIZE_CODE
 * e.g. BRAC-001-GRN-S, BRAC-001-BEI-S, BRAC-001-DEF
 */
export function generateDefaultSku(productCode: string, color?: string, size?: string): string {
  const pCode = (productCode || 'PROD-001').trim().toUpperCase();
  const cCode = getColorCode(color);
  const sCode = getSizeCode(size);

  if (cCode && sCode) {
    return `${pCode}-${cCode}-${sCode}`;
  }
  if (cCode) {
    return `${pCode}-${cCode}`;
  }
  if (sCode) {
    return `${pCode}-${sCode}`;
  }
  return `${pCode}-DEF`;
}

