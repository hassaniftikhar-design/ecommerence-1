import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import type { OrderListItem } from "@/types/order.types";

// Server Component: a static list with a Link per row -- no client
// state needed, so (unlike CartTable) this never needs "use client".
export function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Order #</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Product(s)</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>{order.date}</TableCell>
            <TableCell>{order.orderNumber}</TableCell>
            <TableCell>{order.user}</TableCell>
            <TableCell>{order.productsCount}</TableCell>
            <TableCell>${order.amount.toFixed(2)}</TableCell>
            <TableCell>
              <Link
                href={ROUTES.orderDetail(order.id)}
                aria-label={`View order ${order.orderNumber}`}
                className="text-ink hover:text-primary"
              >
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
