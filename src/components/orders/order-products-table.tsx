import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderProductLine } from "@/types/order.types";

export function OrderProductsTable({
  products,
}: {
  products: OrderProductLine[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((line) => (
          <TableRow key={line.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-page">
                  <Image
                    src={line.imageUrl}
                    alt={line.title}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <span className="max-w-md">{line.title}</span>
              </div>
            </TableCell>
            <TableCell>${line.price.toFixed(2)}</TableCell>
            <TableCell>{line.quantity}</TableCell>
            <TableCell>{line.stock}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
