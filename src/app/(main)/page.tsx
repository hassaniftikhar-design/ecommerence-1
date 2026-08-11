import type { Metadata } from "next";

import { ProductSearchBar } from "@/components/home/product-search-bar";
import { CategoryDropdown } from "@/components/home/category-dropdown";
import { SortDropdown } from "@/components/home/sort-dropdown";
import { ProductGrid } from "@/components/home/product-grid";
import { HomeOrdersModal } from "@/components/orders/home-orders-modal";
import { getProducts, getCategories } from "@/services/product.service";

export const metadata: Metadata = {
  title: "Our Products",
  description: "Browse the full E-commerce product catalog.",
  openGraph: { title: "Our Products | E-commerce" },
};

interface HomePageProps {
  searchParams?: Promise<{
    q?: string;
    search?: string;
    category?: string;
    sort?: string;
    orders?: string;
    orderId?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const q = params?.q || params?.search || "";
  const category = params?.category || "";
  const sort = params?.sort || "";
  const ordersParam = params?.orders;
  const orderIdParam = params?.orderId;

  const [products, categories] = await Promise.all([
    getProducts(q, category, sort),
    getCategories(),
  ]);

  return (
    <div className="w-full px-2 sm:px-4 md:px-[56px] lg:px-[60px]">
      <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-semibold text-[#007BFF]">
          Our Products
        </h1>

        <div className="flex w-full flex-col sm:flex-row items-center gap-4.5 md:w-auto md:gap-3">
          <div className="w-full sm:w-[260px] md:w-[280px]">
            <ProductSearchBar />
          </div>
          <div className="w-full sm:w-[140px]">
            <CategoryDropdown categories={categories} />
          </div>
          <div className="w-full sm:w-[140px]">
            <SortDropdown />
          </div>
        </div>
      </div>

      <ProductGrid products={products} />

      <HomeOrdersModal
        openOrders={Boolean(ordersParam)}
        initialOrderId={orderIdParam}
      />
    </div>
  );
}
