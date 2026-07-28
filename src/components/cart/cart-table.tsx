"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { useCartSelection } from "@/hooks/use-cart-selection";
import type { CartItem } from "@/types/cart.types";

// Client Component: the select-all checkbox needs to know about, and
// affect, every row's checkbox state -- that shared state (via
// useCartSelection) is the only reason this table itself needs to be
// client-side rather than a plain Server Component wrapping client
// leaves like ProductGrid does.
export function CartTable({ items }: { items: CartItem[] }) {
  const itemIds = items.map((item) => item.id);
  const { allSelected, toggleAll, toggleOne, isSelected } =
    useCartSelection(itemIds);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all items"
              />
              Product
            </div>
          </TableHead>
          <TableHead>Color</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            checked={isSelected(item.id)}
            onToggle={toggleOne}
          />
        ))}
      </TableBody>
    </Table>
  );
}
