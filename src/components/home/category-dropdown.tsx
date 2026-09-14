'use client';

interface CategoryDropdownProps {
  categories: { id: string; name: string }[];
  value?: string;
  onChange?: (value: string) => void;
}

export function CategoryDropdown({
  categories,
  value = '',
  onChange
}: CategoryDropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <select
      id="category-filter"
      value={value}
      onChange={handleChange}
      aria-label="Filter by category"
      className="h-8 w-full rounded border border-[#E2E8F0] bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BFF]/40 sm:text-sm cursor-pointer"
    >
      <option value="">All Categories</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.name}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}
