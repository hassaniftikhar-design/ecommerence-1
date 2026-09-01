import { ProductGridSkeleton } from '@/components/home/product-grid-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="w-full px-2 sm:px-4 md:px-[56px] lg:px-[60px] space-y-6">
      {/* Header Controls Skeleton */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <div className="flex w-full flex-row items-center gap-2 md:w-auto md:gap-4">
          <Skeleton className="h-8 w-full md:w-[280px] rounded-md" />
          <Skeleton className="h-8 w-[130px] rounded-md" />
          <Skeleton className="h-8 w-[130px] rounded-md" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <ProductGridSkeleton count={8} />
    </div>
  );
}
