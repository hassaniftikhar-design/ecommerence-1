"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { useSession } from "next-auth/react";

import { OrderSummaryFields } from "@/components/orders/order-summary-fields";
import { OrderProductsTable } from "@/components/orders/order-products-table";
import { renderStatusBadge } from "@/components/orders/orders-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { getOrderById, updateOrderStatus } from "@/services/order.service";
import type { OrderDetail, OrderStatusType } from "@/types/order.types";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusValue, setStatusValue] = useState<OrderStatusType>("IN_PROGRESS");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getOrderById(id);
        setOrder(data);
        setStatusValue(data.status);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleUpdateStatus = async () => {
    try {
      setUpdating(true);
      setError(null);
      await updateOrderStatus(id, statusValue);
      setSuccessMsg("Order status updated successfully!");
      if (order) {
        setOrder({ ...order, status: statusValue });
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 font-medium">
        Loading order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 w-full">
        <div className="flex items-center gap-3">
          <Link href={ROUTES.adminOrders} className="text-[#0B192C] hover:text-[#007BFF] transition">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-[#0B192C]">Order Detail</h1>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-xs font-semibold text-red-600 border border-red-200">
          {error || "Order not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Top Heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.adminOrders}
            className="text-[#0B192C] hover:text-[#007BFF] transition"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-[#0B192C]">Order Detail</h1>
        </div>

        {/* Status Admin Control */}
        <div className="flex items-center gap-3">
          {renderStatusBadge(order.status)}
          <Select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as OrderStatusType)}
            className="w-40 h-9 text-xs"
          >
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED">Rejected</option>
          </Select>
          <Button
            onClick={handleUpdateStatus}
            disabled={updating || statusValue === order.status}
            className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs h-9 px-4 font-semibold"
          >
            {updating ? "Updating..." : "Update Status"}
          </Button>
        </div>
      </div>

      <hr className="border-slate-200" />

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-600 border border-emerald-200 flex items-center gap-2">
          <Check className="h-4 w-4" /> {successMsg}
        </div>
      )}

      {/* Metadata Summary Header */}
      <OrderSummaryFields order={order} />

      {/* Product Information Table */}
      <div className="pt-2">
        <h2 className="text-lg font-bold text-[#0B192C] mb-4">Product Information</h2>
        <OrderProductsTable products={order.products} />
      </div>
    </div>
  );
}
