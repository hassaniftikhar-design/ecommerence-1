import 'server-only';

import type { ChatContextMessage } from './conversation-state';

export const COLOR_SYNONYMS: Record<string, string[]> = {
  black: ['black', 'blk', 'kala', 'kaali', 'kale', 'kalay', 'سیاہ', 'کالا', 'کالی', 'کالے'],
  white: ['white', 'wht', 'safed', 'chitta', 'chitti', 'سفید', 'چٹا', 'چٹی'],
  red: ['red', 'lal', 'laal', 'surkh', 'سرخ', 'لال'],
  blue: ['blue', 'blu', 'neela', 'neeli', 'neelay', 'نیلا', 'نیلی', 'نیلے'],
  green: ['green', 'grn', 'sabz', 'hara', 'hari', 'hare', 'haray', 'سبز', 'ہرا', 'ہری', 'ہرے'],
  yellow: ['yellow', 'yel', 'peela', 'peeli', 'peelay', 'پیلا', 'پیلی', 'پیلے'],
  gray: ['gray', 'grey', 'gry', 'surmai', 'سرمئی', 'گری', 'گرے'],
  brown: ['brown', 'brw', 'bhoora', 'bhoori', 'براؤن', 'بھورا', 'بھوری'],
  beige: ['beige', 'bei', 'بیج', 'بایج'],
  orange: ['orange', 'ora', 'narangi', 'نارنجی', 'اورنج'],
  pink: ['pink', 'gulabi', 'گلابی'],
  purple: ['purple', 'jamni', 'جامنی']
};

export const SIZE_SYNONYMS: Record<string, string[]> = {
  xs: ['xs', 'extra small', 'x-small'],
  s: ['s', 'small', 'sm', 'chota', 'choti', 'chotay', 'چھوٹا', 'چھوٹی', 'چھوٹے'],
  m: ['m', 'med', 'medium', 'darmyana', 'darmiyana', 'درمیانہ'],
  l: ['l', 'lg', 'large', 'lrg', 'bara', 'bari', 'bare', 'baray', 'بڑا', 'بڑی', 'بڑے'],
  xl: ['xl', 'extra large', 'x-large', '1xl'],
  '2xl': ['2xl', 'xxl', 'extra extra large', 'double xl', '2-xl'],
  '3xl': ['3xl', 'xxxl', 'triple xl', '3-xl']
};

export function extractQuantityFromMessage(message: string): number {
  const qtyMatch = message.match(/\b(?:quantity|qty)\s*[:=]?\s*(\d+)\b/i);
  if (qtyMatch && qtyMatch[1]) {
    const val = parseInt(qtyMatch[1], 10);
    if (val > 0 && val <= 20) return val;
  }
  const digitMatch = message.match(/\b([1-9]|10)\s+(?:[a-zA-Z\u0600-\u06FF]+)/i);
  if (digitMatch && digitMatch[1]) {
    const val = parseInt(digitMatch[1], 10);
    if (val > 0 && val <= 20) return val;
  }
  const wordQty: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    ek: 1, do: 2, teen: 3, char: 4, panch: 5,
    ایک: 1, دو: 2, تین: 3, چار: 4, پانچ: 5
  };
  const wordMatch = message.match(/\b(one|two|three|four|five|ek|do|teen|char|panch|ایک|دو|تین|چار|پانچ)\s+(?:[a-zA-Z\u0600-\u06FF]+)/i);
  if (wordMatch && wordMatch[1]) {
    const w = wordMatch[1].toLowerCase();
    if (wordQty[w]) return wordQty[w];
  }
  return 1;
}

export type VariantResolution<T> =
  | {
      status: 'EXACT';
      variant: T;
      specifiedAttributes: Record<string, string>;
    }
  | {
      status: 'AMBIGUOUS';
      matchingVariants: T[];
      availableOptionsSummary: Array<{ name: string; values: string[] }>;
      specifiedAttributes: Record<string, string>;
    }
  | {
      status: 'MISSING_OPTIONS';
      missingOptionNames: string[];
      availableOptionsSummary: Array<{ name: string; values: string[] }>;
      specifiedAttributes: Record<string, string>;
    }
  | {
      status: 'NOT_FOUND';
      reason: string;
      availableOptionsSummary: Array<{ name: string; values: string[] }>;
      specifiedAttributes: Record<string, string>;
    };

export function resolveProductVariant<T extends { id: string; sku: string; stock: number; attributes?: Record<string, string> }>(
  product: {
    name: string;
    variants: T[];
  },
  message: string,
  hints?: { color?: string; size?: string; variantId?: string },
  context: ChatContextMessage[] = []
): VariantResolution<T> {
  const variants = product.variants || [];
  if (variants.length === 0) {
    return {
      status: 'NOT_FOUND',
      reason: 'No variants are registered for this product.',
      availableOptionsSummary: [],
      specifiedAttributes: {}
    };
  }

  // 1. Explicit variantId hint
  if (hints?.variantId) {
    const explicit = variants.find((v) => v.id === hints.variantId);
    if (explicit) {
      return {
        status: 'EXACT',
        variant: explicit,
        specifiedAttributes: explicit.attributes || {}
      };
    }
    return {
      status: 'NOT_FOUND',
      reason: 'The specified variant ID does not exist for this product.',
      availableOptionsSummary: [],
      specifiedAttributes: {}
    };
  }

  // 2. Extract color and size prioritizing hints and current message over older context
  const extractColor = (text: string): string | null => {
    const lower = text.toLowerCase();
    for (const [canonical, syns] of Object.entries(COLOR_SYNONYMS)) {
      if (syns.some((syn) => new RegExp(`(^|[^\\p{L}\\p{N}])${syn}([^\\p{L}\\p{N}]|$)`, 'u').test(lower))) {
        return canonical;
      }
    }
    return null;
  };

  const extractSize = (text: string): string | null => {
    const lower = text.toLowerCase();
    for (const [canonical, syns] of Object.entries(SIZE_SYNONYMS)) {
      if (syns.some((syn) => {
        if (syn.length === 1) {
          return (
            new RegExp(`\\b(?:size|no)\\s*${syn}\\b`, 'i').test(lower) ||
            new RegExp(`\\b${syn}\\s*(?:size)\\b`, 'i').test(lower) ||
            new RegExp(`(?:^|\\s)${syn}(?:\\s|$)`, 'i').test(lower)
          );
        }
        return new RegExp(`(^|[^\\p{L}\\p{N}])${syn}([^\\p{L}\\p{N}]|$)`, 'u').test(lower);
      })) {
        return canonical;
      }
    }
    return null;
  };

  let specifiedColor: string | null = null;
  if (hints?.color) {
    const hintLower = hints.color.toLowerCase();
    for (const [canonical, syns] of Object.entries(COLOR_SYNONYMS)) {
      if (syns.includes(hintLower) || canonical === hintLower) {
        specifiedColor = canonical;
        break;
      }
    }
    if (!specifiedColor) specifiedColor = hintLower;
  }
  if (!specifiedColor) {
    specifiedColor = extractColor(message);
  }
  if (!specifiedColor && context.length > 0) {
    const recentUserMsgs = context.filter((c) => c.role === 'USER').reverse();
    for (const uMsg of recentUserMsgs) {
      const found = extractColor(uMsg.content);
      if (found) {
        specifiedColor = found;
        break;
      }
    }
  }

  let specifiedSize: string | null = null;
  if (hints?.size) {
    const hintLower = hints.size.toLowerCase();
    for (const [canonical, syns] of Object.entries(SIZE_SYNONYMS)) {
      if (syns.includes(hintLower) || canonical === hintLower) {
        specifiedSize = canonical;
        break;
      }
    }
    if (!specifiedSize) specifiedSize = hintLower;
  }
  if (!specifiedSize) {
    specifiedSize = extractSize(message);
  }
  if (!specifiedSize && context.length > 0) {
    const recentUserMsgs = context.filter((c) => c.role === 'USER').reverse();
    for (const uMsg of recentUserMsgs) {
      const found = extractSize(uMsg.content);
      if (found) {
        specifiedSize = found;
        break;
      }
    }
  }

  // 3. Single variant product validation
  if (variants.length === 1 && variants[0]) {
    const single = variants[0];
    const singleAttrs = single.attributes || {};

    if (specifiedColor) {
      const colorAttrEntry = Object.entries(singleAttrs).find(([k]) => /(color|colour|rang)/i.test(k));
      if (colorAttrEntry) {
        const colorVal = colorAttrEntry[1].toLowerCase();
        const matches = COLOR_SYNONYMS[specifiedColor]?.includes(colorVal) || colorVal.includes(specifiedColor) || specifiedColor === colorVal;
        if (!matches) {
          return {
            status: 'NOT_FOUND',
            reason: `The requested color "${specifiedColor}" is not available for this product (available in ${colorAttrEntry[1]} only).`,
            availableOptionsSummary: [{ name: colorAttrEntry[0], values: [colorAttrEntry[1]] }],
            specifiedAttributes: { [colorAttrEntry[0]]: specifiedColor }
          };
        }
      }
    }

    if (specifiedSize) {
      const sizeAttrEntry = Object.entries(singleAttrs).find(([k]) => /size/i.test(k));
      if (sizeAttrEntry) {
        const sizeVal = sizeAttrEntry[1].toLowerCase();
        const matches = SIZE_SYNONYMS[specifiedSize]?.includes(sizeVal) || sizeVal === specifiedSize || specifiedSize === sizeVal;
        if (!matches) {
          return {
            status: 'NOT_FOUND',
            reason: `The requested size "${specifiedSize.toUpperCase()}" is not available for this product (available in ${sizeAttrEntry[1].toUpperCase()} only).`,
            availableOptionsSummary: [{ name: sizeAttrEntry[0], values: [sizeAttrEntry[1]] }],
            specifiedAttributes: { [sizeAttrEntry[0]]: specifiedSize }
          };
        }
      }
    }

    return {
      status: 'EXACT',
      variant: single,
      specifiedAttributes: singleAttrs
    };
  }

  // 4. Determine option categories and their distinct values
  const optionMap = new Map<string, Set<string>>();
  for (const variant of variants) {
    if (variant.attributes) {
      for (const [k, v] of Object.entries(variant.attributes)) {
        if (!optionMap.has(k)) optionMap.set(k, new Set());
        if (v && v.trim()) optionMap.get(k)!.add(v.trim());
      }
    }
  }

  const multiChoiceOptions = [...optionMap.entries()].filter(([, valSet]) => valSet.size > 1);
  const specifiedAttributes: Record<string, string> = {};
  const missingOptionNames: string[] = [];

  for (const [optName, valSet] of multiChoiceOptions) {
    const lowerOpt = optName.toLowerCase();
    let isSpecified = false;

    if (lowerOpt.includes('color') || lowerOpt.includes('colour') || lowerOpt.includes('rang')) {
      if (specifiedColor) {
        const matchedVal = [...valSet].find((v) => {
          const lv = v.toLowerCase();
          return COLOR_SYNONYMS[specifiedColor!]?.includes(lv) || lv.includes(specifiedColor!) || specifiedColor === lv;
        });
        if (matchedVal) {
          isSpecified = true;
          specifiedAttributes[optName] = matchedVal;
        }
      }
    } else if (lowerOpt.includes('size')) {
      if (specifiedSize) {
        const matchedVal = [...valSet].find((v) => {
          const lv = v.toLowerCase();
          return SIZE_SYNONYMS[specifiedSize!]?.includes(lv) || lv === specifiedSize || specifiedSize === lv;
        });
        if (matchedVal) {
          isSpecified = true;
          specifiedAttributes[optName] = matchedVal;
        }
      }
    } else {
      for (const val of valSet) {
        const lowerVal = val.toLowerCase();
        if (message.toLowerCase().includes(lowerVal) || context.some((c) => c.content.toLowerCase().includes(lowerVal))) {
          isSpecified = true;
          specifiedAttributes[optName] = val;
          break;
        }
      }
    }

    if (!isSpecified) {
      missingOptionNames.push(optName);
    }
  }

  // 5. Build availableOptionsSummary (dynamically filtered by any already specified attributes)
  const availableOptionsSummary: Array<{ name: string; values: string[] }> = [];
  for (const [optName, valSet] of multiChoiceOptions) {
    let filteredValues = [...valSet];
    const otherSpecs = { ...specifiedAttributes };
    delete otherSpecs[optName];

    if (Object.keys(otherSpecs).length > 0) {
      const matchingVariants = variants.filter((v) => {
        if (v.stock < 1) return false;
        for (const [specK, specV] of Object.entries(otherSpecs)) {
          if (v.attributes && v.attributes[specK] && v.attributes[specK] !== specV) {
            return false;
          }
        }
        return true;
      });
      const specificValues = new Set<string>();
      for (const mv of matchingVariants) {
        if (mv.attributes && mv.attributes[optName]) {
          specificValues.add(mv.attributes[optName]);
        }
      }
      if (specificValues.size > 0) {
        filteredValues = [...specificValues];
      }
    }

    availableOptionsSummary.push({ name: optName, values: filteredValues });
  }

  // 6. Check for missing required options
  if (missingOptionNames.length > 0) {
    return {
      status: 'MISSING_OPTIONS',
      missingOptionNames,
      availableOptionsSummary,
      specifiedAttributes
    };
  }

  // 7. If all multi-choice options are specified, filter variants to find matches
  const matchingVariants = variants.filter((v) => {
    const attrs = v.attributes || {};
    for (const [specK, specV] of Object.entries(specifiedAttributes)) {
      if (attrs[specK] && attrs[specK] !== specV) {
        return false;
      }
    }
    return true;
  });

  if (matchingVariants.length === 0) {
    return {
      status: 'NOT_FOUND',
      reason: 'The requested variant combination does not exist in the catalog.',
      availableOptionsSummary,
      specifiedAttributes
    };
  }

  if (matchingVariants.length === 1 && matchingVariants[0]) {
    return {
      status: 'EXACT',
      variant: matchingVariants[0],
      specifiedAttributes
    };
  }

  // 8. Multiple variants match
  return {
    status: 'AMBIGUOUS',
    matchingVariants,
    availableOptionsSummary,
    specifiedAttributes
  };
}

export function matchVariantFromMessage<T extends { id: string; sku: string; stock: number; attributes?: Record<string, string> }>(
  variants: T[],
  message: string,
  hints?: { color?: string; size?: string; variantId?: string }
): { variant: T | null; isExactSpecMatch: boolean } {
  const resolution = resolveProductVariant({ name: 'Product', variants }, message, hints);
  if (resolution.status === 'EXACT') {
    return { variant: resolution.variant, isExactSpecMatch: true };
  }
  return { variant: null, isExactSpecMatch: false };
}

export type MissingOptionCheck = {
  hasMissingOptions: boolean;
  missingOptionNames: string[];
  availableOptionsSummary: Array<{
    name: string;
    values: string[];
  }>;
  specifiedAttributes: Record<string, string>;
};

export function detectMissingProductOptions<T extends { id: string; sku: string; stock: number; attributes?: Record<string, string> }>(
  product: {
    name: string;
    variants: T[];
  },
  message: string,
  context: ChatContextMessage[] = []
): MissingOptionCheck {
  const resolution = resolveProductVariant(product, message, undefined, context);
  if (resolution.status === 'MISSING_OPTIONS') {
    return {
      hasMissingOptions: true,
      missingOptionNames: resolution.missingOptionNames,
      availableOptionsSummary: resolution.availableOptionsSummary,
      specifiedAttributes: resolution.specifiedAttributes
    };
  }
  if (resolution.status === 'AMBIGUOUS') {
    return {
      hasMissingOptions: true,
      missingOptionNames: ['option'],
      availableOptionsSummary: resolution.availableOptionsSummary,
      specifiedAttributes: resolution.specifiedAttributes
    };
  }
  if (resolution.status === 'NOT_FOUND') {
    return {
      hasMissingOptions: false,
      missingOptionNames: [],
      availableOptionsSummary: resolution.availableOptionsSummary,
      specifiedAttributes: resolution.specifiedAttributes
    };
  }
  return {
    hasMissingOptions: false,
    missingOptionNames: [],
    availableOptionsSummary: [],
    specifiedAttributes: resolution.specifiedAttributes
  };
}
