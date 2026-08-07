"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { AdminOrdersView } from "@/components/orders/admin-orders-view";
import { ROUTES } from "@/constants/routes";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <AdminOrdersView
      initialOrderId={id}
      onCloseDrawer={() => router.push(ROUTES.adminOrders)}
    />
  );
}
