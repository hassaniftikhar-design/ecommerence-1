import type { Metadata } from "next";

import { ProductSearchBar } from "@/components/home/product-search-bar";
import { SortDropdown } from "@/components/home/sort-dropdown";
import { ProductGrid } from "@/components/home/product-grid";
import { MOCK_PRODUCTS } from "@/constants/mock-products";

export const metadata: Metadata = {
  title: "Our Products",
  description: "Browse the full E-commerce product catalog.",
  openGraph: { title: "Our Products | E-commerce" },
};

// Server Component. SiteHeader and the max-w-7xl container now live in
// (main)/layout.tsx -- this page only owns what's actually specific to
// the Home screen (the "Our Products" heading, search/sort controls,
// and the grid itself).
export default function HomePage() {
  const products = MOCK_PRODUCTS;

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-semibold text-primary">Our Products</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ProductSearchBar />
          <SortDropdown />
        </div>
      </div>

      <ProductGrid products={products} />
    </>
  );
}
