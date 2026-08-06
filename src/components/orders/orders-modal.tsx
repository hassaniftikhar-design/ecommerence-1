"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrderSummaryFields } from "@/components/orders/order-summary-fields";
import { OrderProductsTable } from "@/components/orders/order-products-table";
import { getOrders, getOrderById } from "@/services/order.service";
import type { OrderDetail, OrderListItem } from "@/types/order.types";
import { cn } from "@/lib/utils";

interface OrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderId?: string | null;
}

export function OrdersModal({ isOpen, onClose, initialOrderId }: OrdersModalProps) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // List view state
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Detail view state
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders list when modal opens or page changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
      setView("detail");
    } else {
      setView("list");
    }
  }, [isOpen, initialOrderId]);

  useEffect(() => {
    if (!isOpen || view !== "list") return;

    async function fetchOrders() {
      try {
        setLoadingOrders(true);
        setError(null);
        const data = await getOrders(currentPage, 6);
        setOrders(data.orders);
        setTotalCount(data.totalCount);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingOrders(false);
      }
    }
    fetchOrders();
  }, [isOpen, view, currentPage]);

  // Fetch order detail when selectedOrderId changes
  useEffect(() => {
    if (!isOpen || view !== "detail" || !selectedOrderId) return;

    async function fetchDetail() {
      if (!selectedOrderId) return;
      try {
        setLoadingDetail(true);
        setError(null);
        const data = await getOrderById(selectedOrderId);
        setOrderDetail(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingDetail(false);
      }
    }
    fetchDetail();
  }, [isOpen, view, selectedOrderId]);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setView("detail");
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedOrderId(null);
    setOrderDetail(null);
  };

  if (!isOpen) return null;

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Right-Side Slider Drawer Container (1138px width, Full height 100vh) */}
      <div
        className={cn(
          "relative z-50 flex flex-col h-full h-screen bg-[#F8FAFC] shadow-2xl border-l border-slate-200 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-right",
          "w-full max-w-[1138px]"
        )}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            {view === "detail" ? (
              <button
                type="button"
                onClick={handleBackToList}
                className="flex items-center gap-2 text-lg font-bold text-[#007BFF] hover:text-blue-700 transition"
              >
                <ArrowLeft className="h-5 w-5" /> Order Detail
              </button>
            ) : (
              <div className="flex items-center gap-2 text-lg font-bold text-[#007BFF]">
                <ArrowLeft className="h-5 w-5 cursor-pointer" onClick={onClose} /> My Orders
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-xs font-semibold text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {view === "list" ? (
            /* VIEW 1: MY ORDERS TABLE */
            <div className="flex flex-col h-full justify-between space-y-6">
              {loadingOrders ? (
                <div className="py-20 text-center text-slate-400 font-medium">
                  Loading orders...
                </div>
              ) : (
                <>
                  <OrdersTable orders={orders} onSelectOrder={handleSelectOrder} />

                  {/* Footer Pagination & Total Count */}
                  <div className="mt-auto pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-500">
                      {totalCount} Total Count
                    </p>

                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xs">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 font-semibold text-blue-600 hover:bg-slate-50 disabled:opacity-40 rounded-md"
                      >
                        Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={cn(
                            "px-3 py-1.5 font-semibold rounded-md transition",
                            currentPage === p
                              ? "bg-blue-50 text-[#007BFF]"
                              : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {p}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 font-semibold text-blue-600 hover:bg-slate-50 disabled:opacity-40 rounded-md"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* VIEW 2: ORDER DETAIL */
            <div className="space-y-6">
              {loadingDetail || !orderDetail ? (
                <div className="py-20 text-center text-slate-400 font-medium">
                  Loading order details...
                </div>
              ) : (
                <>
                  <OrderSummaryFields order={orderDetail} />

                  <div className="pt-2">
                    <h2 className="mb-4 text-lg font-bold text-[#0B192C]">
                      Product Information
                    </h2>
                    <OrderProductsTable products={orderDetail.products} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
