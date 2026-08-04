"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { MOCK_PRODUCTS } from "@/constants/mock-products";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  const order = MOCK_ORDERS.find((o) => o.id === id) || {
    id,
    date: "23 March 2023",
    orderNumber: "342599",
    user: "Jackson Smith",
    productsCount: 3,
    amount: 149.99,
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Heading */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.adminOrders}
          className="text-[#0B192C] hover:text-[#007BFF] transition"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-[#0B192C]">Order Detail</h1>
      </div>

      <hr className="border-slate-200" />

      {/* Metadata Grid Header */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-3 text-sm border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-medium text-slate-400">Date</p>
          <p className="font-semibold text-slate-800 mt-1">{order.date}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">Order #</p>
          <p className="font-semibold text-slate-800 mt-1">{order.orderNumber}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">User</p>
          <p className="font-semibold text-slate-800 mt-1">{order.user}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">Products</p>
          <p className="font-semibold text-slate-800 mt-1">{String(order.productsCount).padStart(2, "0")}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">Amount</p>
          <p className="font-semibold text-slate-800 mt-1">${order.amount.toFixed(2)}</p>
        </div>
      </div>

      {/* Section Title */}
      <div className="pt-2">
        <h2 className="text-lg font-bold text-[#0B192C] mb-4">Product Information</h2>

        {/* Product Information Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 border-b border-slate-200">
                <TableHead className="w-[50%] font-semibold text-slate-600">Title</TableHead>
                <TableHead className="font-semibold text-slate-600">Price</TableHead>
                <TableHead className="font-semibold text-slate-600">Quantity</TableHead>
                <TableHead className="font-semibold text-slate-600">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PRODUCTS.slice(0, order.productsCount || 3).map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/50 border-b border-slate-100">
                  <TableCell className="py-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-10 w-10 shrink-0 rounded object-cover border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-slate-700">
                          {item.name} - 6 Pocket Trousers in all Colors
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                    ${item.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                    12
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                    {item.stock}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
