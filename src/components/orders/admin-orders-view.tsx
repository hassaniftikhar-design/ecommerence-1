"use client";

import { useState, useEffect } from "react";
import { Search, ShoppingBag, Package, DollarSign, ArrowUpRight } from "lucide-react";
import { useSession } from "next-auth/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { renderStatusBadge } from "@/components/orders/orders-table";
import { AdminOrderDrawer } from "@/components/orders/admin-order-drawer";
import { getOrders } from "@/services/order.service";
import type { OrderListItem } from "@/types/order.types";

export interface AdminOrdersViewProps {
  initialOrderId?: string | null;
  onCloseDrawer?: () => void;
}

export function AdminOrdersView({
  initialOrderId = null,
  onCloseDrawer,
}: AdminOrdersViewProps = {}) {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(Boolean(initialOrderId));
  const pageSize = 10;

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await getOrders(currentPage, pageSize, searchQuery);
      setOrders(data.orders);
      setTotalCount(data.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [currentPage, searchQuery]);

  useEffect(() => {
    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
      setDrawerOpen(true);
    }
  }, [initialOrderId]);

  const handleOpenDrawer = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedOrderId(null);
    onCloseDrawer?.();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const totalUnits = orders.reduce((acc, o) => acc + o.productsCount, 0);
  const totalAmount = orders
    .filter((o) => o.status !== "REJECTED")
    .reduce((acc, o) => acc + o.amount, 0);

  return (
    <div className="space-y-6">
      {/* Stat Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Orders:</p>
            <p className="text-2xl font-bold text-[#007BFF] mt-1">{totalCount}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Units:</p>
            <p className="text-2xl font-bold text-[#007BFF] mt-1">{totalUnits}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Amount:</p>
            <p className="text-2xl font-bold text-[#007BFF] mt-1">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Title & Search Bar Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <h1 className="text-2xl font-bold text-[#007BFF]">Orders</h1>

        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search user, order ID, product, category..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-xs sm:text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-[#007BFF]"
          />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 border-b border-slate-200">
              <TableHead className="font-semibold text-slate-600">Date</TableHead>
              <TableHead className="font-semibold text-slate-600">Order #</TableHead>
              <TableHead className="font-semibold text-slate-600">User</TableHead>
              <TableHead className="font-semibold text-slate-600">Product(s)</TableHead>
              <TableHead className="font-semibold text-slate-600">Amount</TableHead>
              <TableHead className="font-semibold text-slate-600">Status</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100">
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-slate-50/60 border-b border-slate-100 cursor-pointer transition-colors"
                  onClick={() => handleOpenDrawer(order.id)}
                >
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.date}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-semibold">{order.orderNumber}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.user}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.productsCount}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                    ${order.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{renderStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDrawer(order.id);
                      }}
                      className="inline-flex items-center text-slate-600 hover:text-[#007BFF] transition p-1"
                      title="View Order Details"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, totalCount)}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalCount}</span> orders
          </div>

          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 border-r border-slate-200 cursor-pointer"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 font-medium border-r border-slate-200 last:border-r-0 cursor-pointer ${
                  currentPage === page ? "text-[#007BFF] bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Order Detail Drawer Slider (1144px width) */}
      <AdminOrderDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        orderId={selectedOrderId}
        onStatusUpdated={loadOrders}
      />
    </div>
  );
}
