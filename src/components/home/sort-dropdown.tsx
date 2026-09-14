'use client';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' }
] as const;

interface SortDropdownProps {
  value?: string;
  onChange?: (value: string) => void;
}

export function SortDropdown({
  value = 'newest',
  onChange
}: SortDropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <select
      id="sort-by"
      value={value}
      onChange={handleChange}
      aria-label="Sort products"
      className="h-8 w-full rounded border border-[#E2E8F0] bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]/40 sm:text-sm cursor-pointer"
    >
      <option value="" disabled>
        Sort by:
      </option>

      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
