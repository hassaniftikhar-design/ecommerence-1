'use client';

import { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import { Search, ShoppingBag, Package, DollarSign, ArrowUpRight, X } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { ROUTES } from '@/constants/routes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { renderStatusBadge, renderPaymentStatusBadge } from '@/components/orders/orders-table';
import { getOrders } from '@/services/order.service';
import type { OrderListItem } from '@/types/order.types';
import { useDebounce } from '@/hooks/use-debounce';
import { getPaginationRange } from '@/lib/pagination-util';

export function AdminOrdersView() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await getOrders(currentPage, pageSize, debouncedSearchQuery);
      setOrders(data.orders);
      setTotalCount(data.totalCount);
      setTotalUnits(data.totalUnits || 0);
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchQuery, status]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setLoading(true);
  };

  const isDebouncing = searchQuery !== debouncedSearchQuery;
  const showSkeletons = loading || isDebouncing;

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-2 text-slate-600">You must be an administrator to view this page.</p>
        <Link href={ROUTES.login} className="mt-4 inline-block font-semibold text-primary underline">
          Go to Login
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</p>
            <h3 className="text-2xl font-bold text-[#0B192C]">{totalCount}</h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units Sold</p>
            <h3 className="text-2xl font-bold text-[#0B192C]">{totalUnits}</h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-bold text-[#0B192C]">${totalAmount.toFixed(2)}</h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#007BFF]">Orders Management</h1>

        <div className="relative w-full sm:w-72 h-9">
          <input
            type="text"
            placeholder="Search by order # or customer name..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-xs sm:text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-[#007BFF]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setLoading(true);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 border-b border-slate-200">
              <TableHead className="font-semibold text-slate-600">Date</TableHead>
              <TableHead className="font-semibold text-slate-600">Order #</TableHead>
              <TableHead className="font-semibold text-slate-600">Customer</TableHead>
              <TableHead className="font-semibold text-slate-600">Items</TableHead>
              <TableHead className="font-semibold text-slate-600">Total Price</TableHead>
              <TableHead className="font-semibold text-slate-600">Status</TableHead>
              <TableHead className="font-semibold text-slate-600">Payment</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeletons ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100">
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-md" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-slate-400">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-slate-50/60 border-b border-slate-100 cursor-pointer transition-colors"
                  onClick={() => router.push(ROUTES.adminOrderDetail(order.id))}
                >
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.date}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-semibold">{order.orderNumber}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.user}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">{order.productsCount}</TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                    ${order.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{renderStatusBadge(order.status)}</TableCell>
                  <TableCell>{renderPaymentStatusBadge(order.paymentStatus, order.paymentMethod)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={ROUTES.adminOrderDetail(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center text-slate-600 hover:text-[#007BFF] transition p-1 cursor-pointer"
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
        <div className="flex justify-between items-center text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
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
            {getPaginationRange(currentPage, totalPages).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 font-medium border-r border-slate-200 last:border-r-0 cursor-pointer ${currentPage === page ? 'text-[#007BFF] bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
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
    </div>
  );
}
