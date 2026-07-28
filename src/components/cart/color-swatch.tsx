import type { CartItemColor } from "@/types/cart.types";

// Small enough to inline, but named/typed because "colored dot + label"
// is a recognizable product-variant pattern that a future product
// detail or order-detail page will likely reuse.
export function ColorSwatch({ color }: { color: CartItemColor }) {
  return (
    <span className="flex items-center gap-2 text-sm text-graytext">
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color.hex }}
        aria-hidden="true"
      />
      {color.name}
    </span>
  );
}
