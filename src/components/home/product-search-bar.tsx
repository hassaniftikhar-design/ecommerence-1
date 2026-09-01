'use client';

import { useState, useEffect, useRef } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';

export function ProductSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || searchParams.get('search') || '';
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 400);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Debounced search effect - only triggers search navigation when user stops typing
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debouncedQuery.trim() !== initialQuery.trim()) {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedQuery.trim()) {
        params.set('q', debouncedQuery.trim());
      } else {
        params.delete('q');
        params.delete('search');
      }
      router.push(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
      params.delete('search');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <form
      role="search"
      onSubmit={handleSearch}
      className="flex h-8 min-w-0 flex-1 overflow-hidden rounded border border-[#E2E8F0] bg-white"
    >
      <label htmlFor="product-search" className="sr-only">
        Search products by title
      </label>

      <input
        id="product-search"
        type="text"
        placeholder="Search products by title..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 border-0 bg-transparent px-3 text-sm text-slate-800 placeholder:text-[#9BA2C1] focus:outline-none"
      />

      <Button
        type="submit"
        aria-label="Search"
        className="flex h-8 w-9 items-center justify-center rounded-none border-0 border-l border-[#E2E8F0] bg-[#F5F5F5] p-0 hover:bg-slate-200 cursor-pointer transition"
      >
        <Search className="h-4 w-4 text-[#003B5C]" strokeWidth={2.2} />
      </Button>
    </form>
  );
}
