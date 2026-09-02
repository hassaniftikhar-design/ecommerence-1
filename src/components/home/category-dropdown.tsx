'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface CategoryDropdownProps {
  categories: { id: string; name: string }[];
}

export function CategoryDropdown({ categories }: CategoryDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get('category') || '';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      id="category-filter"
      value={selectedCategory}
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
