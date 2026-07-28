import type { Metadata } from "next";

import { BackHeading } from "@/components/common/back-heading";
import { OrdersTable } from "@/components/orders/orders-table";
import { Pagination } from "@/components/ui/pagination";
import {
  MOCK_ORDERS,
  MOCK_ORDERS_PAGE_SIZE,
  MOCK_ORDERS_TOTAL_COUNT,
} from "@/constants/mock-orders";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Orders",
  description: "View your past orders.",
  openGraph: { title: "Orders | E-commerce" },
};

// Server Component that reads the page number straight from the URL's
// search params -- Next.js passes `searchParams` to page components
// for free, so pagination needs zero client-side state (see
// components/ui/pagination.tsx for the other half of this).
// TODO(backend-integration): pass the parsed page number to
// order.service.ts#getOrders(page) once it reads from a real,
// paginated "orders" table.
export default function OrdersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const currentPage = Math.max(1, Number(searchParams.page) || 1);
  const totalPages = Math.ceil(
    MOCK_ORDERS_TOTAL_COUNT / MOCK_ORDERS_PAGE_SIZE,
  );

  return (
    <>
      <BackHeading title="Orders" href={ROUTES.home} />
      <OrdersTable orders={MOCK_ORDERS} />
      <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-meta">{MOCK_ORDERS_TOTAL_COUNT} Total Count</p>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath={ROUTES.orders}
        />
      </div>
    </>
  );
}
