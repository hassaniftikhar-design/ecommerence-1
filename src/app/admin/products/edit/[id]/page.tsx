"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { AdminProductsView } from "@/components/forms/admin-products-view";
import { ROUTES } from "@/constants/routes";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <AdminProductsView
      initialEditProductId={id}
      onCloseEditDrawer={() => router.push(ROUTES.adminProducts)}
    />
  );
}
