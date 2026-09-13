import { DEFAULT_PRODUCT_IMAGE } from '@/constants/generalconstants';

/**
 * Safely parses and normalizes an image URL for Next.js <Image /> component or standard <img> tags.
 * Ensures the returned string starts with http://, https://, data:, blob:, or / so Next.js never throws.
 */
export function getValidImageUrl(
  url?: string | null,
  fallback: string = DEFAULT_PRODUCT_IMAGE
): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object Object]') {
    return fallback;
  }

  // Absolute http/https URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Base64 data or blob URL
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Relative path already starting with /
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Unprefixed relative filename/path (e.g., "sleveless_green.png" or "uploads/image.jpg")
  return `/${trimmed}`;
}
