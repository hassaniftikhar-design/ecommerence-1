"use client";

import { useState } from "react";

// A native <select> rather than a custom Radix/shadcn dropdown: the
// Figma shows plain browser-native affordances (default arrow, no
// custom popover styling), and a native select is also free
// keyboard/screen-reader accessibility the brief asks for.
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export function SortDropdown() {
  const [value, setValue] = useState<string>("");

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-by" className="text-sm text-ink">
        Sort by:
      </label>
      <select
        id="sort-by"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 rounded border border-border bg-surface-card px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <option value="" disabled>
          Select
        </option>
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
