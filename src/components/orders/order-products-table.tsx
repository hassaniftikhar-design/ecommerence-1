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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/60 border-b border-slate-200">
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Title</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Price</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Quantity</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-28 text-center text-slate-400 text-xs">
                No items found in this order.
              </TableCell>
            </TableRow>
          ) : (
            products.map((line) => (
              <TableRow key={line.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                      <Image
                        src={
                          line.imageUrl ||
                          "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80"
                        }
                        alt={line.title}
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    </div>
                    <span className="text-xs text-slate-700 font-medium max-w-md line-clamp-2">
                      {line.title}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-700 font-medium py-3">
                  ${line.price.toFixed(2)}
                </TableCell>
                <TableCell className="text-xs text-slate-700 font-medium py-3">
                  {line.quantity}
                </TableCell>
                <TableCell className="text-xs text-slate-700 font-medium py-3">
                  {line.stock}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
