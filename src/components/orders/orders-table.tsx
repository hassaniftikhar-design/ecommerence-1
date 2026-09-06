'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowUpRight } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import type { OrderListItem, OrderStatusType } from '@/types/order.types';
import type { PaymentStatus } from '@/types/payment.types';
import { cn } from '@/lib/utils';

interface OrdersTableProps {
  orders: OrderListItem[];
  onSelectOrder?: (orderId: string) => void;
}

export function renderStatusBadge(status: OrderStatusType) {
  let label = 'In Progress';
  let badgeStyle = 'bg-[#F59E0B] text-white';

  switch (status) {
    case 'DELIVERED':
      label = 'Delivered';
      badgeStyle = 'bg-[#22C55E] text-white';
      break;
    case 'IN_PROGRESS':
      label = 'In Progress';
      badgeStyle = 'bg-[#F59E0B] text-white';
      break;
    case 'DISPATCHED':
      label = 'Dispatched';
      badgeStyle = 'bg-[#007BFF] text-white';
      break;
    case 'REJECTED':
      label = 'Rejected';
      badgeStyle = 'bg-[#EF4444] text-white';
      break;
    default:
      label = 'In Progress';
      badgeStyle = 'bg-[#F59E0B] text-white';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-semibold min-w-[90px] text-center shadow-xs',
        badgeStyle
      )}
    >
      {label}
    </span>
  );
}

export function renderPaymentStatusBadge(
  status?: PaymentStatus | string | null,
  paymentMethod?: string
) {
  let label = 'Pending';
  let badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';

  if (!status) {
    if (paymentMethod === 'Cash on Delivery' || paymentMethod === 'COD') {
      label = 'Pending (COD)';
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    } else {
      label = 'Pending';
      badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    }
  } else {
    switch (status) {
      case 'SUCCEEDED':
        label = 'Paid';
        badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'PENDING':
        label = paymentMethod === 'Cash on Delivery' ? 'Pending (COD)' : 'Pending';
        badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'PROCESSING':
        label = 'Processing';
        badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'FAILED':
        label = 'Failed';
        badgeStyle = 'bg-red-50 text-red-700 border-red-200';
        break;
      case 'REFUNDED':
        label = 'Refunded';
        badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'PARTIALLY_REFUNDED':
        label = 'Partial Refund';
        badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      default:
        label = String(status);
        badgeStyle = 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold border min-w-[75px] text-center shadow-2xs',
        badgeStyle
      )}
    >
      {label}
    </span>
  );
}

export function OrdersTable({ orders, onSelectOrder }: OrdersTableProps) {
  const router = useRouter();

  const handleRowClick = (orderId: string) => {
    if (onSelectOrder) {
      onSelectOrder(orderId);
    } else {
      router.push(ROUTES.orderDetail(orderId));
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/60 border-b border-slate-200">
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Date</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Order #</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Number of Product(s)</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Amount</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Order Status</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-slate-400 text-xs">
                No orders found.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow
                key={order.id}
                onClick={() => handleRowClick(order.id)}
                className="hover:bg-slate-50/80 border-b border-slate-100 cursor-pointer transition-colors"
              >
                <TableCell className="text-slate-700 text-xs font-medium py-3.5">{order.date}</TableCell>
                <TableCell className="text-slate-700 text-xs font-medium py-3.5">{order.orderNumber}</TableCell>
                <TableCell className="text-slate-700 text-xs font-medium py-3.5">{order.productsCount}</TableCell>
                <TableCell className="text-slate-700 text-xs font-medium py-3.5">${order.amount.toFixed(2)}</TableCell>
                <TableCell className="py-3.5">{renderStatusBadge(order.status)}</TableCell>
                <TableCell className="py-3.5 text-right">
                  {onSelectOrder ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order.id);
                      }}
                      aria-label={`View order ${order.orderNumber}`}
                      className="text-slate-600 hover:text-[#007BFF] transition inline-flex p-1"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </button>
                  ) : (
                    <Link
                      href={ROUTES.orderDetail(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`View order ${order.orderNumber}`}
                      className="text-slate-600 hover:text-[#007BFF] transition inline-flex p-1"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

