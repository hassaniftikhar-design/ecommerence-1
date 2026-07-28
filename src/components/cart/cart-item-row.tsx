"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { QuantitySelector } from "@/components/home/quantity-selector";
import { ColorSwatch } from "@/components/cart/color-swatch";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { removeCartItem } from "@/services/cart.service";
import type { CartItem } from "@/types/cart.types";

interface CartItemRowProps {
  item: CartItem;
  checked: boolean;
  onToggle: (id: string) => void;
}

// Client Component: owns the row checkbox and hosts the remove
// confirmation. The quantity stepper is NOT reimplemented here --
// it's the exact same <QuantitySelector> from components/home used on
// the product grid, which is the point of extracting it into its own
// component during Phase 1 rather than inlining it in ProductCard.
export function CartItemRow({ item, checked, onToggle }: CartItemRowProps) {
  const handleRemove = () => {
    // TODO(backend-integration): call cart.service.ts#removeCartItem
    // and then refresh the cart (likely via router.refresh() once this
    // reads from a real Server Component data source).
    void removeCartItem(item.id).catch(() => {
      // Swallowed on purpose: the service call is a stub that always
      // throws today. Real error handling (toast, inline message)
      // arrives with the backend implementation.
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(item.id)}
            aria-label={`Select ${item.name}`}
          />
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-surface-page">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <span className="max-w-md text-sm text-graytext">{item.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <ColorSwatch color={item.color} />
      </TableCell>
      <TableCell>{item.size}</TableCell>
      <TableCell>
        <QuantitySelector initialValue={item.quantity} />
      </TableCell>
      <TableCell>${item.price.toFixed(2)}</TableCell>
      <TableCell>
        <ConfirmDialog
          trigger={
            <button
              type="button"
              aria-label={`Remove ${item.name} from cart`}
              className="text-danger hover:opacity-80"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          }
          title="Remove Product"
          description="Are You Sure You Want To Delete The Item!"
          onConfirm={handleRemove}
        />
      </TableCell>
    </TableRow>
  );
}
