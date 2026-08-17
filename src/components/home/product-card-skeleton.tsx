import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs space-y-3">
      <Skeleton className="aspect-square w-full rounded-xl bg-slate-100 animate-pulse" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-4 w-3/4 rounded-md bg-slate-100" />
        <Skeleton className="h-3 w-1/2 rounded-md bg-slate-100" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-5 w-16 rounded-md bg-slate-100" />
        <Skeleton className="h-8 w-20 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
