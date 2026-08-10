"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, PackageCheck } from "lucide-react";

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
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const toggleRowExpand = (itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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
            products.map((line) => {
              const isExpanded = expandedItemIds.has(line.id);
              const lineSubtotal = line.price * line.quantity;

              return (
                <React.Fragment key={line.id}>
                  <TableRow
                    className="border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer transition-colors"
                    onClick={() => toggleRowExpand(line.id)}
                  >
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-[#007BFF] transition shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpand(line.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-[#007BFF]" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
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
                        <span className="text-xs text-slate-800 font-semibold max-w-md line-clamp-2">
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
                      <span className={line.stock > 0 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                        {line.stock} in stock
                      </span>
                    </TableCell>
                  </TableRow>

                  {/* Inline Expanded Product Line Item Breakdown */}
                  {isExpanded && (
                    <TableRow className="bg-slate-50/80 border-b border-slate-200">
                      <TableCell colSpan={4} className="p-4">
                        <div className="rounded-md border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-slate-700 font-semibold border-b border-slate-100 pb-2">
                            <PackageCheck className="h-4 w-4 text-[#007BFF]" />
                            <span>Detailed Item Breakdown</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 pt-1">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Unit Price</span>
                              <span className="font-medium text-slate-800">${line.price.toFixed(2)}</span>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[11px]">Quantity Ordered</span>
                              <span className="font-medium text-slate-800">{line.quantity} units</span>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[11px]">Line Total</span>
                              <span className="font-bold text-[#007BFF]">${lineSubtotal.toFixed(2)}</span>
                            </div>

                            <div>
                              <span className="text-slate-400 block text-[11px]">Current Stock</span>
                              <span className="font-medium text-slate-800">{line.stock} remaining</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
