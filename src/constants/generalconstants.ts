export const MAX_VISIBLE_SIZES_DESKTOP = 3;
export const MAX_VISIBLE_SIZES_MOBILE = 2;

export const MAX_VISIBLE_COLORS_DESKTOP = 4;
export const MAX_VISIBLE_COLORS_MOBILE = 3;
export const TAX_RATE = 0.10; // 10% Tax
export const DEFAULT_PRODUCT_IMAGE = '/placeholder-product.png';

// Product Catalog Virtualization & Data Fetching Constants
export const PRODUCT_FETCH_BATCH_SIZE = 10;
export const PRODUCT_RENDER_WINDOW_SIZE = 12;
export const PRODUCT_CACHE_SIZE = 100;
export const PRODUCT_CACHE_MAX_PAGES = Math.floor(PRODUCT_CACHE_SIZE / PRODUCT_FETCH_BATCH_SIZE); // 10 pages

// Responsive Grid Virtualization Geometry Constants
export const PRODUCT_ESTIMATED_ROW_HEIGHT_PX = 420;
export const PRODUCT_GRID_GAP_DESKTOP_PX = 24;
export const PRODUCT_GRID_GAP_MOBILE_PX = 16;
export const PRODUCT_PREFETCH_ROOT_MARGIN = '300px';
export const PRODUCT_VIRTUAL_OVERSCAN_ROWS = 1;

// Backward compatibility constants
export const PRODUCTS_PER_PAGE = PRODUCT_FETCH_BATCH_SIZE;
//export const LAZY_LOAD_DELAY_MS = 0;

export const NOTIFICATIONS_PER_PAGE = 10;
export const NOTIFICATIONS_LAZY_LOAD_DELAY_MS = 2000;

// Backward compatibility constants
export const MAX_VISIBLE_SIZES = MAX_VISIBLE_SIZES_DESKTOP;
export const MAX_VISIBLE_COLORS = MAX_VISIBLE_COLORS_DESKTOP;

export const COLOR_MAP: Record<string, string> = {
  black: '#18181B',
  white: '#FFFFFF',
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#10B981',
  yellow: '#EAB308',
  purple: '#A855F7',
  pink: '#EC4899',
  orange: '#F97316',
  gray: '#6B7280',
  grey: '#6B7280',
  navy: '#1E3A8A',
  'navy blue': '#1E3A8A',
  brown: '#78350F',
  beige: '#F5F5DC',
  gold: '#D97706',
  silver: '#9CA3AF',
  maroon: '#800000',
  cyan: '#06B6D4',
  teal: '#14B8A6',
  olive: '#84CC16',
  indigo: '#6366F1'
};

export const COLOR_OPTIONS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Gray',
  'Navy',
  'Brown',
  'Pink',
  'Purple',
  'Orange',
  'Beige'
];

export const SIZE_OPTIONS = [
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '3XL',
  'XS'
];

export function getColorHex(colorName: string): string {
  if (!colorName) return '#9CA3AF';
  const normalized = colorName.trim().toLowerCase();
  return COLOR_MAP[normalized] || colorName;
}
