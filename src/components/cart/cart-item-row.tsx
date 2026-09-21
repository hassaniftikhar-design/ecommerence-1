'use client';

import Image from 'next/image';

import { Trash2 } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { QuantitySelector } from '@/components/home/quantity-selector';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { getValidImageUrl } from '@/lib/image-util';
import type { CartItem } from '@/types/cart.types';

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
  onRemove
}: CartItemRowProps) {
  const itemTotalPrice = item.totalPrice ?? item.quantity * item.price;
  const colorName = typeof item.color === 'string' ? item.color : item.color?.name;

  return (
    <TableRow className="hover:bg-slate-50/50 border-b border-slate-100">
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(item.id)}
            aria-label={`Select ${item.name}`}
          />
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            <Image
              src={getValidImageUrl(item.imageUrl)}
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

      <TableCell className="text-xs sm:text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full border border-slate-300 shrink-0"
            style={{
              backgroundColor: colorName?.toLowerCase() || '#94a3b8'
            }}
          />
          <span className="font-medium text-slate-700 capitalize">
            {colorName || 'Default'}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-xs sm:text-sm text-slate-700">
        <span className="inline-block px-2.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700">
          {item.size || 'Fixed'}
        </span>
      </TableCell>

      <TableCell>
        <QuantitySelector
          initialValue={item.quantity}
          max={item.stock}
          onChange={(newQty) => onUpdateQuantity(item.id, newQty)}
        />
      </TableCell>

      <TableCell className="text-xs sm:text-sm font-medium text-slate-700">
        ${item.price.toFixed(2)}
      </TableCell>

      <TableCell className="text-xs sm:text-sm font-bold text-slate-900">
        ${itemTotalPrice.toFixed(2)}
      </TableCell>

      <TableCell className="text-right pr-4">
        <ConfirmDialog
          trigger={
            <button
              type="button"
              aria-label={`Remove ${item.name} from cart`}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
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
