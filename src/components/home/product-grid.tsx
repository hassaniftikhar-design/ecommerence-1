import { ProductCard } from "@/components/home/product-card";
import type { Product } from "@/types/product.types";

// Server Component: it only maps static data into <ProductCard />
// leaves. Each ProductCard opts into "use client" individually for its
// own interactive bits, which keeps the grid's own JS footprint at
// zero -- a good example of "push client boundaries as far down the
// tree as possible" rather than marking the whole page client-side.
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
