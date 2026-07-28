import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackHeading } from "@/components/common/back-heading";
import { OrderSummaryFields } from "@/components/orders/order-summary-fields";
import { OrderProductsTable } from "@/components/orders/order-products-table";
import { MOCK_ORDER_DETAIL } from "@/constants/mock-orders";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Order Detail",
  description: "View the details of a single order.",
  openGraph: { title: "Order Detail | E-commerce" },
};

// Server Component. `params.orderId` comes from the dynamic route
// segment. TODO(backend-integration): swap MOCK_ORDER_DETAIL for
// `await getOrderById(params.orderId)`; the notFound() call below is
// already wired for when that lookup returns null.
export default function OrderDetailPage({
  params,
}: {
  params: { orderId: string };
}) {
  const order = params.orderId ? MOCK_ORDER_DETAIL : null;

  if (!order) {
    notFound();
  }

  return (
    <>
      <BackHeading title="Order Detail" href={ROUTES.orders} variant="navy" />
      <OrderSummaryFields order={order} />
      <h2 className="mb-4 mt-8 text-2xl font-semibold text-navy">
        Product Information
      </h2>
      <OrderProductsTable products={order.products} />
    </>
  );
}
