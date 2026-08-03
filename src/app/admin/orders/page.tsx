"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, ShoppingBag, Package, DollarSign } from "lucide-react";
import { useSession } from "next-auth/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { MOCK_ORDERS } from "@/constants/mock-orders";

export default function AdminOrdersPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  const filteredOrders = MOCK_ORDERS.filter(
    (order) =>
      order.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Stat Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Orders */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Orders:</p>
            <p className="text-2xl font-bold text-[#007BFF] mt-1">12</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Total Units */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Units:</p>
            <p className="text-2xl font-bold text-[#007BFF] mt-1">43</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
            <Package className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Total Amount */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Amount:</p>
            <p className="text-2xl font-bold text-[#007BFF] mt-1">$100,000</p>
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
            placeholder="Search by user & order ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-slate-50/50 border-b border-slate-100">
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.date}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600 font-medium">{order.orderNumber}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.user}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.productsCount}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                    ${order.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={ROUTES.adminOrderDetail(order.id)}
                      className="inline-flex items-center text-slate-600 hover:text-[#007BFF] transition"
                      title="View Order Details"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end">
          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 border-r border-slate-200"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 font-medium border-r border-slate-200 last:border-r-0 ${
                  currentPage === page ? "text-[#007BFF] bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
