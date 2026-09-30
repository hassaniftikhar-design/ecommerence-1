'use client';

import { useMemo } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { PackageX, AlertCircle, RefreshCw } from 'lucide-react';

import { ProductCard } from '@/components/home/product-card';
import { ProductCardSkeleton } from '@/components/home/product-card-skeleton';
import { Button } from '@/components/ui/button';
import { getProducts, type PaginatedProductsResponse } from '@/services/product.service';
import {
  PRODUCT_FETCH_BATCH_SIZE,
  PRODUCT_CACHE_MAX_PAGES
} from '@/constants/generalconstants';
import { useProductVirtualization } from '@/hooks/use-product-virtualization';
import type { Product } from '@/types/product.types';

export interface ProductGridProps {
  initialData: PaginatedProductsResponse;
  q?: string;
  category?: string;
  sort?: string;
}

export function ProductGrid({ initialData, q = '', category = '', sort = '' }: ProductGridProps) {
  const isInitialFilter = !q && !category && (!sort || sort === 'newest');

  const {
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading,
    status,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['products', { q, category, sort }],
    queryFn: async ({ pageParam = 1 }) => {
      return getProducts({
        page: pageParam as number,
        limit: PRODUCT_FETCH_BATCH_SIZE,
        q,
        category,
        sort
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    getPreviousPageParam: (firstPage) => {
      return firstPage.page > 1 ? firstPage.page - 1 : undefined;
    },
    maxPages: PRODUCT_CACHE_MAX_PAGES,
    initialData: isInitialFilter
      ? {
        pages: [initialData],
        pageParams: [1]
      }
      : undefined,
    staleTime: 60 * 1000
  });

  const products = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const list: Product[] = [];
    for (const page of data.pages) {
      if (!page?.products) continue;
      for (const item of page.products) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    return list;
  }, [data?.pages]);

  const firstLoadedPage = data?.pages?.[0]?.page ?? 1;
  const totalCatalogCount = data?.pages?.[0]?.total ?? products.length;
  const filterKey = `${q}|${category}|${sort}`;

  const {
    visibleProducts,
    topSpacerHeight,
    bottomSpacerHeight,
    outerWrapperRef,
    topSentinelRef,
    bottomSentinelRef
  } = useProductVirtualization({
    items: products,
    totalCatalogCount,
    firstLoadedPageNumber: firstLoadedPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    filterKey
  });

  if (isLoading && products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 my-6">
        {Array.from({ length: 8 }).map((_, idx) => (
          <ProductCardSkeleton key={`skeleton-initial-${idx}`} />
        ))}
      </div>
    );
  }

  if (status === 'error' && products.length === 0) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-10 text-center shadow-xs my-6 flex flex-col items-center justify-center space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6 stroke-[2]" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load Products</h3>
        <p className="text-xs text-slate-600 max-w-sm">
          {(error as Error)?.message ||
            'Something went wrong while fetching products. Please try again.'}
        </p>
        <Button
          type="button"
          onClick={() => refetch()}
          className="mt-2 bg-[#007BFF] hover:bg-blue-600 text-white font-semibold text-xs px-5 py-2 rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Request
        </Button>
      </div>
    );
  }

  if (products.length === 0 && !isFetchingNextPage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs my-6 flex flex-col items-center justify-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] border border-blue-100 shadow-xs">
          <PackageX className="h-8 w-8 stroke-[1.75]" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">No Products Found</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          We could not find any products matching your search or filter criteria. Try adjusting your
          search term or category!
        </p>
      </div>
    );
  }

  return (
    <div ref={outerWrapperRef} className="space-y-6 my-6">
      <div ref={topSentinelRef} className="h-1 w-full pointer-events-none" aria-hidden="true" />

      {topSpacerHeight > 0 && (
        <div
          style={{ height: `${topSpacerHeight}px` }}
          className="w-full pointer-events-none"
          aria-hidden="true"
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {isFetchingPreviousPage &&
          Array.from({ length: 4 }).map((_, idx) => (
            <ProductCardSkeleton key={`skeleton-prev-${idx}`} />
          ))}
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {isFetchingNextPage &&
          Array.from({ length: 4 }).map((_, idx) => (
            <ProductCardSkeleton key={`skeleton-next-${idx}`} />
          ))}
      </div>

      {bottomSpacerHeight > 0 && (
        <div
          style={{ height: `${bottomSpacerHeight}px` }}
          className="w-full pointer-events-none"
          aria-hidden="true"
        />
      )}

      <div ref={bottomSentinelRef} className="h-1 w-full pointer-events-none" aria-hidden="true" />

      {status === 'error' && products.length > 0 && (
        <div className="flex flex-col items-center justify-center pt-3 pb-4 space-y-2">
          <p className="text-xs text-red-500 font-medium">Failed to load more products.</p>
          <Button
            type="button"
            onClick={() => fetchNextPage()}
            variant="outline"
            className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
          >
            Try Loading More
          </Button>
        </div>
      )}

      {!hasNextPage && products.length > 0 && !isFetchingNextPage && (
        <div className="pt-3 pb-2 text-center">
          <p className="text-xs font-medium text-slate-400">
            You&apos;ve reached the end of the product catalog.
          </p>
        </div>
      )}
    </div>
  );
}
