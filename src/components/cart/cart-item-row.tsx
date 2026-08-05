"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { QuantitySelector } from "@/components/home/quantity-selector";
import { ColorSwatch } from "@/components/cart/color-swatch";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { CartItem } from "@/types/cart.types";

interface CartItemRowProps {
  item: CartItem;
  checked: boolean;
  onToggle: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemRow({
  item,
  checked,
  onToggle,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps) {
  const itemTotalPrice = item.totalPrice ?? item.quantity * item.price;

  return (
    <TableRow className="hover:bg-slate-50/50 border-b border-slate-100">
      {/* 1. Product (Checkbox + Image + Name) */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(item.id)}
            aria-label={`Select ${item.name}`}
          />
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="56px"
              unoptimized
            />
          </div>
          <span className="max-w-md text-xs sm:text-sm font-medium text-slate-700 line-clamp-2">
            {item.name}
          </span>
        </div>
      </TableCell>

      {/* 2. Color */}
      <TableCell className="text-xs sm:text-sm text-slate-700">
        <ColorSwatch color={item.color} />
      </TableCell>

      {/* 3. Size */}
      <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
        {item.size || "-"}
      </TableCell>

      {/* 4. Quantity */}
      <TableCell>
        <QuantitySelector
          initialValue={item.quantity}
          onChange={(newQty) => onUpdateQuantity(item.id, newQty)}
        />
      </TableCell>

      {/* 5. Unit Price */}
      <TableCell className="text-xs sm:text-sm font-medium text-slate-700">
        ${item.price.toFixed(2)}
      </TableCell>

      {/* 6. Total Price (NEW Column as shown in design!) */}
      <TableCell className="text-xs sm:text-sm font-semibold text-slate-900">
        ${itemTotalPrice.toFixed(2)}
      </TableCell>

      {/* 7. Actions */}
      <TableCell>
        <ConfirmDialog
          trigger={
            <button
              type="button"
              aria-label={`Remove ${item.name} from cart`}
              className="text-red-500 hover:text-red-700 transition p-1"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          }
          title="Remove Product"
          description="Are you sure you want to delete this item from your shopping bag?"
          onConfirm={() => onRemove(item.id)}
        />
      </TableCell>
    </TableRow>
  );
}
