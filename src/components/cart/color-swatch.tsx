import type { CartItemColor } from "@/types/cart.types";

export function ColorSwatch({ color }: { color?: CartItemColor | string }) {
  if (!color) {
    return <span className="text-sm text-gray-500">-</span>;
  }

  const name = typeof color === "string" ? color : color.name;
  const hex = typeof color === "object" && color.hex ? color.hex : undefined;

  // Simple color mapping helper for standard color names if hex is omitted
  const colorMap: Record<string, string> = {
    beige: "#F5F5DC",
    bage: "#D2B48C",
    black: "#000000",
    white: "#FFFFFF",
    blue: "#007BFF",
    red: "#FF0000",
    green: "#28A745",
    grey: "#808080",
    gray: "#808080",
    brown: "#8B4513",
  };

  const dotColor = hex || colorMap[name.toLowerCase()] || "#A0AEC0";

  return (
    <span className="flex items-center gap-2 text-sm text-slate-700 font-medium">
      <span
        className="h-3 w-3 rounded-full border border-slate-300 shrink-0"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      {name}
    </span>
  );
}
