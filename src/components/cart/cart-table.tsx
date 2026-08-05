"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { useCartSelection } from "@/hooks/use-cart-selection";
import type { CartItem } from "@/types/cart.types";

interface CartTableProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function CartTable({
  items,
  onUpdateQuantity,
  onRemoveItem,
}: CartTableProps) {
  const itemIds = items.map((item) => item.id);
  const { allSelected, toggleAll, toggleOne, isSelected } =
    useCartSelection(itemIds);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
        <p className="text-base font-semibold">Your shopping bag is empty.</p>
        <p className="text-xs text-slate-400 mt-1">
          Explore products on the homepage and add them to your cart.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/70 border-b border-slate-200">
            <TableHead className="w-[35%] font-semibold text-slate-600">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all items"
                />
                Product
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-600">Color</TableHead>
            <TableHead className="font-semibold text-slate-600">Size</TableHead>
            <TableHead className="font-semibold text-slate-600">Qty</TableHead>
            <TableHead className="font-semibold text-slate-600">Price</TableHead>
            <TableHead className="font-semibold text-slate-600">Total Price</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              checked={isSelected(item.id)}
              onToggle={toggleOne}
              onUpdateQuantity={onUpdateQuantity}
              onRemove={onRemoveItem}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
