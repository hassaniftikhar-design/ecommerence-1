export const MAX_VISIBLE_SIZES_DESKTOP = 3;
export const MAX_VISIBLE_SIZES_MOBILE = 2;

export const MAX_VISIBLE_COLORS_DESKTOP = 4;
export const MAX_VISIBLE_COLORS_MOBILE = 3;
export const TAX_RATE = 0.10; // 10% Tax
export const DEFAULT_PRODUCT_IMAGE = "/placeholder-product.png";
// Backward compatibility constants
export const MAX_VISIBLE_SIZES = MAX_VISIBLE_SIZES_DESKTOP;
export const MAX_VISIBLE_COLORS = MAX_VISIBLE_COLORS_DESKTOP;

export const COLOR_MAP: Record<string, string> = {
  black: "#18181B",
  white: "#FFFFFF",
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#10B981",
  yellow: "#EAB308",
  purple: "#A855F7",
  pink: "#EC4899",
  orange: "#F97316",
  gray: "#6B7280",
  grey: "#6B7280",
  navy: "#1E3A8A",
  "navy blue": "#1E3A8A",
  brown: "#78350F",
  beige: "#F5F5DC",
  gold: "#D97706",
  silver: "#9CA3AF",
  maroon: "#800000",
  cyan: "#06B6D4",
  teal: "#14B8A6",
  olive: "#84CC16",
  indigo: "#6366F1",
};

export const COLOR_OPTIONS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Gray",
  "Navy",
  "Brown",
  "Pink",
  "Purple",
  "Orange",
  "Beige",
];

export const SIZE_OPTIONS = [
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "XS",
];

export function getColorHex(colorName: string): string {
  if (!colorName) return "#9CA3AF";
  const normalized = colorName.trim().toLowerCase();
  return COLOR_MAP[normalized] || colorName;
}