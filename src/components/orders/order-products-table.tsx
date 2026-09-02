'use client';

import React, { useState, useMemo } from 'react';

import Image from 'next/image';

import { ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { OrderProductLine } from '@/types/order.types';
import { VariantBadge } from '@/components/common/variant-badge';

interface GroupedProductOrder {
  key: string;
  productId?: string;
  title: string;
  imageUrl: string;
  totalQuantity: number;
  totalAmount: number;
  items: OrderProductLine[];
}

export function OrderProductsTable({
  products
}: {
  products: OrderProductLine[];
}) {
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const toggleRowExpand = (groupKey: string) => {
    setExpandedGroupKey((prev) => (prev === groupKey ? null : groupKey));
  };

  // Group order line items by Product (productId || title)
  const groupedProducts = useMemo(() => {
    const map = new Map<string, GroupedProductOrder>();

    for (const item of products) {
      const key = item.productId || item.title;
      const existing = map.get(key);

      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalAmount += item.price * item.quantity;
        existing.items.push(item);
      } else {
        map.set(key, {
          key,
          productId: item.productId,
          title: item.title,
          imageUrl: item.imageUrl,
          totalQuantity: item.quantity,
          totalAmount: item.price * item.quantity,
          items: [item]
        });
      }
    }

    return Array.from(map.values());
  }, [products]);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/60 border-b border-slate-200">
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5 w-[40%]">Title</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Price</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5">Quantity</TableHead>
            <TableHead className="font-semibold text-slate-600 text-xs py-3.5 text-right">Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-28 text-center text-slate-400 text-xs">
                No items found in this order.
              </TableCell>
            </TableRow>
          ) : (
            groupedProducts.map((group) => {
              const isExpanded = expandedGroupKey === group.key;
              const variantCount = group.items.length;
              const unitPrice = group.items[0]?.price ?? (group.totalAmount / (group.totalQuantity || 1));
              const totalStock = group.items.reduce((acc, it) => acc + (it.stock || 0), 0);

              return (
                <React.Fragment key={group.key}>
                  <TableRow
                    className="border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer transition-colors"
                    onClick={() => toggleRowExpand(group.key)}
                  >
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                          <Image
                            src={
                              group.imageUrl ||
                              '/placeholder-product.png'
                            }
                            alt={group.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                            unoptimized
                          />
                        </div>
                        <span className="text-xs text-slate-800 font-semibold max-w-md line-clamp-2">
                          {group.title.replace(/\s*\([^)]*\)$/, '')}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-slate-700 font-medium py-3">
                      ${unitPrice.toFixed(2)}
                    </TableCell>

                    <TableCell className="text-xs text-slate-700 font-medium py-3">
                      {String(group.totalQuantity).padStart(2, '0')}
                    </TableCell>

                    <TableCell className="text-xs text-slate-700 font-medium py-3 text-right pr-6">
                      <div className="inline-flex items-center gap-2">
                        <span>{totalStock}</span>
                        {variantCount > 0 && (
                          isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-[#007BFF]" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Variant Breakdown Row */}
                  {isExpanded && (
                    <TableRow className="bg-slate-50/70 border-b border-slate-200">
                      <TableCell colSpan={4} className="p-4 sm:p-5">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <PackageCheck className="h-4 w-4 text-[#007BFF]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                              Ordered Variant Breakdown ({variantCount})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {group.items.map((item, idx) => {
                              const lineSubtotal = item.price * item.quantity;
                              return (
                                <div
                                  key={item.id || idx}
                                  className="flex flex-col justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <VariantBadge color={item.color} size={item.size} />
                                      <span className="font-semibold text-slate-800">
                                        {item.color || 'Standard'} {item.size || ''}
                                      </span>
                                    </div>
                                    <span
                                      className={
                                        item.stock > 0
                                          ? 'text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                                          : 'text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200'
                                      }
                                    >
                                      Stock: {item.stock}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60 text-[11px]">
                                    <span>Qty: <strong className="text-slate-800">{item.quantity}</strong></span>
                                    <span>Unit: <strong className="text-slate-800">${item.price.toFixed(2)}</strong></span>
                                    <span>Total: <strong className="text-[#007BFF]">${lineSubtotal.toFixed(2)}</strong></span>
                                  </div>
                                </div>
                              );
                            })}
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
