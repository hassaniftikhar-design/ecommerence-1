import type { Metadata } from "next";

import { ProductSearchBar } from "@/components/home/product-search-bar";
import { SortDropdown } from "@/components/home/sort-dropdown";
import { ProductGrid } from "@/components/home/product-grid";
import { getProducts } from "@/services/product.service";

export const metadata: Metadata = {
  title: "Our Products",
  description: "Browse the full E-commerce product catalog.",
  openGraph: { title: "Our Products | E-commerce" },
};

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-semibold text-[#007BFF]">
          Our Products
        </h1>
        
        <div className="flex w-full flex-row items-center gap-2 max-[395px]:flex-col max-[395px]:gap-3 md:w-auto md:gap-4">
          <div className="flex-1 max-[395px]:w-full md:w-[320px]">
            <ProductSearchBar />
          </div>
          <div className="w-[120px] shrink-0 max-[395px]:w-full md:w-[140px]">
            <SortDropdown />
          </div>
        </div>
      </div>

      <ProductGrid products={products} />
    </div>
  );
}
   