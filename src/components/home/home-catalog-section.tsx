'use client';

import { useState, useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { ProductSearchBar } from '@/components/home/product-search-bar';
import { CategoryDropdown } from '@/components/home/category-dropdown';
import { SortDropdown } from '@/components/home/sort-dropdown';
import { ProductGrid } from '@/components/home/product-grid';
import type { PaginatedProductsResponse } from '@/services/product.service';

interface HomeCatalogSectionProps {
  initialProducts: PaginatedProductsResponse;
  categories: { id: string; name: string }[];
}

export function HomeCatalogSection({
  initialProducts,
  categories
}: HomeCatalogSectionProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');

  // Immediately clear any residual search parameters from URL on load / reload
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', pathname);
    }
  }, [pathname]);

  return (
    <>
      <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-semibold text-[#007BFF]">
          Our Products
        </h1>

        <div className="flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <div className="w-full sm:w-[260px] md:w-[280px]">
            <ProductSearchBar value={query} onChange={setQuery} />
          </div>
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
            <div className="w-full sm:w-[140px]">
              <CategoryDropdown
                categories={categories}
                value={category}
                onChange={setCategory}
              />
            </div>
            <div className="w-full sm:w-[140px]">
              <SortDropdown value={sort} onChange={setSort} />
            </div>
          </div>
        </div>
      </div>

      <ProductGrid
        initialData={initialProducts}
        q={query}
        category={category}
        sort={sort}
      />
    </>
  );
}
