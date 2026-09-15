import { DEFAULT_PRODUCT_IMAGE } from '@/constants/generalconstants';

const KNOWN_PUBLIC_ASSETS = new Set([
  '/placeholder-product.png',
  '/placeholder-product.svg',
  '/placeholder.png',
  '/placeholder.svg',
  '/FastShopStore.png'
]);

/**
 * Safely parses and normalizes an image URL for Next.js <Image /> component or standard <img> tags.
 * Ensures the returned string is a valid hosted URL, data/blob URL, or recognized static asset in public/.
 * If the image is missing or is an unhosted local filename, returns the default placeholder image.
 */
export function getValidImageUrl(
  url?: string | null,
  fallback: string = DEFAULT_PRODUCT_IMAGE
): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '[object Object]' ||
    trimmed === 'None' ||
    trimmed === 'NaN'
  ) {
    return fallback;
  }

  // Absolute http/https URL (e.g. Cloudinary, Unsplash)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Base64 data or blob URL
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Known valid static asset in public/
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (KNOWN_PUBLIC_ASSETS.has(normalizedPath)) {
    return normalizedPath;
  }

  // Any other local filename that is not hosted on Cloudinary and not a known public asset
  // should gracefully use the default placeholder image so it renders cleanly and never 404s.
  return fallback;
}
