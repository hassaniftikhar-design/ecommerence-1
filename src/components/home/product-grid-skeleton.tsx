import { Skeleton } from "@/components/ui/skeleton";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4 space-y-3"
        >
          {/* Product Image Placeholder */}
          <Skeleton className="aspect-square w-full rounded-lg bg-slate-200" />

          {/* Title Placeholder */}
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />

          {/* Price & Stock Row Placeholder */}
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Selectors Placeholder */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>

          {/* Quantity & Add to Cart Action Row Placeholder */}
          <div className="flex items-center justify-between gap-2 pt-2 mt-auto">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
