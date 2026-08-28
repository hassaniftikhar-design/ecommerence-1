import type { Metadata } from "next";

import { ProductSearchBar } from "@/components/home/product-search-bar";
import { CategoryDropdown } from "@/components/home/category-dropdown";
import { SortDropdown } from "@/components/home/sort-dropdown";
import { ProductGrid } from "@/components/home/product-grid";
import { HomeFiltersReset } from "@/components/home/home-filters-reset";
import { WelcomeToast } from "@/components/common/welcome-toast";
import { getProducts, getCategories } from "@/services/product.service";
import { PRODUCT_FETCH_BATCH_SIZE } from "@/constants/generalconstants";

export const metadata: Metadata = {
  title: "ShopFastStore",
  description: "Browse the full ShopFastStore product catalog.",
  openGraph: { title: "ShopFastStore | Our Products" },
};

interface HomePageProps {
  searchParams?: Promise<{
    q?: string;
    search?: string;
    category?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const q = params?.q || params?.search || "";
  const category = params?.category || "";
  const sort = params?.sort || "";

  const [initialProducts, categories] = await Promise.all([
    getProducts({
      page: 1,
      limit: PRODUCT_FETCH_BATCH_SIZE,
      q,
      category,
      sort,
    }),
    getCategories(),
  ]);

  return (
    <div className="w-full px-2 sm:px-4 md:px-[56px] lg:px-[60px]">
      <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-semibold text-[#007BFF]">
          Our Products
        </h1>

        <div className="flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <div className="w-full sm:w-[260px] md:w-[280px]">
            <ProductSearchBar />
          </div>
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
            <div className="w-full sm:w-[140px]">
              <CategoryDropdown categories={categories} />
            </div>
            <div className="w-full sm:w-[140px]">
              <SortDropdown />
            </div>
          </div>
        </div>
      </div>

      <ProductGrid initialData={initialProducts} q={q} category={category} sort={sort} />
      <WelcomeToast />
      <HomeFiltersReset />
    </div>
  );
}
