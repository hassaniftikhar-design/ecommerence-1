import { PackageX } from "lucide-react";
import { ProductCard } from "@/components/home/product-card";
import type { Product } from "@/types/product.types";

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products || products.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs my-6 flex flex-col items-center justify-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] border border-blue-100 shadow-xs">
          <PackageX className="h-8 w-8 stroke-[1.75]" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">No Products Available</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          We could not find any products available in our catalog at the moment. Please check back later!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}