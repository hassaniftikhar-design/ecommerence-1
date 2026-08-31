"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, X, AlertCircle, ShieldAlert, CreditCard } from "lucide-react";
import { OrderSummaryFields } from "@/components/orders/order-summary-fields";
import { OrderProductsTable } from "@/components/orders/order-products-table";
import { renderStatusBadge } from "@/components/orders/orders-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getOrderById, updateOrderStatus } from "@/services/order.service";
import type { OrderDetail, OrderStatusType } from "@/types/order.types";
import { cn } from "@/lib/utils";

interface AdminOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  onStatusUpdated?: () => void;
}

const ALLOWED_STATUS_OPTIONS: Record<
  OrderStatusType,
  { value: OrderStatusType; label: string }[]
> = {
  IN_PROGRESS: [
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "DISPATCHED", label: "Dispatched" },
    { value: "REJECTED", label: "Rejected" },
  ],
  DISPATCHED: [
    { value: "DISPATCHED", label: "Dispatched" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "REJECTED", label: "Rejected" },
  ],
  DELIVERED: [{ value: "DELIVERED", label: "Delivered" }],
  REJECTED: [{ value: "REJECTED", label: "Rejected" }],
};

export function renderPaymentBadge(payment?: OrderDetail["payment"]) {
  if (!payment) return null;
  const status = payment.status;

  const colorMap: Record<string, string> = {
    SUCCEEDED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
    REFUNDED: "bg-purple-50 text-purple-700 border-purple-200",
    PARTIALLY_REFUNDED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const cls = colorMap[status] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      <CreditCard className="h-3 w-3" />
      Payment: {status}
    </span>
  );
}

export function AdminOrderDrawer({
  isOpen,
  onClose,
  orderId,
  onStatusUpdated,
}: AdminOrderDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusValue, setStatusValue] = useState<OrderStatusType>("IN_PROGRESS");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentOptions = order ? ALLOWED_STATUS_OPTIONS[order.status] || [] : [];
  const isTerminalStatus = order?.status === "DELIVERED" || order?.status === "REJECTED";

  const isPaymentLocked = Boolean(
    order?.payment &&
      (order.payment.status === "PENDING" ||
        order.payment.status === "PROCESSING" ||
        order.payment.status === "FAILED")
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !orderId) return;

    async function fetchDetail() {
      if (!orderId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getOrderById(orderId);
        setOrder(data);
        setStatusValue(data.status);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [isOpen, orderId]);

  const handleUpdateStatus = async () => {
    if (!orderId) return;
    try {
      setUpdating(true);
      setError(null);
      await updateOrderStatus(orderId, statusValue);
      setSuccessMsg("Order status updated successfully!");
      if (order) {
        setOrder({ ...order, status: statusValue });
      }
      onStatusUpdated?.();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Right-Side Slider Drawer Container (Exact width 1144px, Full height 100vh) */}
      <div
        className={cn(
          "relative z-[10000] flex flex-col h-screen h-full bg-[#F8FAFC] shadow-2xl border-l border-slate-200 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-right",
          "w-full max-w-[1144px]"
        )}
      >
        {/* Top Header Bar */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 text-lg font-bold text-[#007BFF] hover:text-blue-700 transition"
            >
              <ArrowLeft className="h-5 w-5" /> Order Detail
            </button>
          </div>

          <div className="flex items-center gap-3">
            {order && renderStatusBadge(order.status)}
            {order?.payment && renderPaymentBadge(order.payment)}

            <Select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value as OrderStatusType)}
              className="w-36 sm:w-40 h-9 text-xs"
              disabled={loading || !order || isTerminalStatus || isPaymentLocked}
            >
              {currentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>

            <Button
              onClick={handleUpdateStatus}
              disabled={
                updating ||
                loading ||
                !order ||
                isTerminalStatus ||
                isPaymentLocked ||
                statusValue === order?.status
              }
              className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs h-9 px-4 font-semibold disabled:opacity-50"
            >
              {updating ? "Updating..." : "Update Status"}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition ml-2"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Payment Status Warning Banner when Locked */}
          {order?.payment && isPaymentLocked && (
            <div className="rounded-xl bg-amber-50 p-4 text-xs font-semibold text-amber-800 border border-amber-200 flex items-start gap-3 shadow-2xs">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">
                  Order Status Updates Locked ({order.payment.status})
                </p>
                <p className="mt-0.5 font-normal text-amber-700">
                  {order.payment.status === "FAILED"
                    ? "Payment for this order has failed. Order status cannot be updated until the customer completes payment."
                    : "Payment for this order is currently pending or processing. Order status cannot be advanced until payment succeeds."}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span className="flex-1 leading-snug">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-600 border border-emerald-200 flex items-center gap-2">
              <Check className="h-4 w-4" /> {successMsg}
            </div>
          )}

          {loading || !order ? (
            <div className="py-20 text-center text-slate-400 font-medium">
              Loading order details...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metadata Summary Header */}
              <OrderSummaryFields order={order} />

              {/* Product Information Table */}
              <div className="pt-2">
                <h2 className="text-lg font-bold text-[#0B192C] mb-4">
                  Product Information
                </h2>
                <OrderProductsTable products={order.products} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
