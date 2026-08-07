"use client";

import { useRouter } from "next/navigation";
import { AdminProductsView } from "@/components/forms/admin-products-view";
import { ROUTES } from "@/constants/routes";

export default function AddSingleProductPage() {
  const router = useRouter();

  return (
    <AdminProductsView
      initialOpenAddDrawer={true}
      onCloseAddDrawer={() => router.push(ROUTES.adminProducts)}
    />
  );
}
