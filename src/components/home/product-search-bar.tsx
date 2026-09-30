'use client';

import { useState, useEffect } from 'react';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';

interface ProductSearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
}

export function ProductSearchBar({
  value = '',
  onChange
}: ProductSearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const debouncedQuery = useDebounce(inputValue, 350);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (onChange && debouncedQuery !== value) {
      onChange(debouncedQuery);
    }
  }, [debouncedQuery, onChange, value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onChange) {
      onChange(inputValue.trim());
    }
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex h-8 min-w-0 flex-1 overflow-hidden rounded border border-[#E2E8F0] bg-white"
    >
      <label htmlFor="product-search" className="sr-only">
        Search products by title
      </label>

      <input
        id="product-search"
        type="text"
        placeholder="Search products by title..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
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
