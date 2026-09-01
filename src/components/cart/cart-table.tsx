'use client';

import Link from 'next/link';

import { ShoppingBag } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { CartItemRow } from '@/components/cart/cart-item-row';
import { useCartSelection } from '@/hooks/use-cart-selection';
import type { CartItem } from '@/types/cart.types';

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
  selectedIds = [],
  onSelectionChange
}: CartTableProps) {
  const itemIds = items.map((item) => item.id);
  const { allSelected, toggleAll, toggleOne, isSelected } =
    useCartSelection(itemIds, selectedIds, onSelectionChange);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 sm:p-14 text-center text-slate-500 flex flex-col items-center justify-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] border border-blue-100 shadow-xs">
          <ShoppingBag className="h-8 w-8 stroke-[1.75]" />
        </div>
        <p className="text-lg font-semibold text-slate-800">Your shopping bag is empty.</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Explore products on the homepage and add them to your cart.
        </p>
        <Link href={ROUTES.home} className="mt-6">
          <Button className="bg-[#007BFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer">
            Go to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/70 border-b border-slate-200">
            <TableHead className="w-[30%] font-semibold text-slate-600">
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
            <TableHead className="font-semibold text-slate-600">Rate</TableHead>
            <TableHead className="font-semibold text-slate-600">Total Price</TableHead>
            <TableHead className="text-right font-semibold text-slate-600 pr-4">Actions</TableHead>
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
