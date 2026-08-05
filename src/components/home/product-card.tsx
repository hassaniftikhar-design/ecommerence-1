"use client";

import { useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuantitySelector } from "@/components/home/quantity-selector";
import { addToCart } from "@/services/cart.service";
import type { Product } from "@/types/product.types";

export function ProductCard({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const firstVariant = product.variants?.[0];

  const handleAddToCart = async () => {
    try {
      setAdding(true);
      await addToCart(product.id, firstVariant?.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const displayImage =
    product.imageUrl ||
    firstVariant?.images?.[0] ||
    "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

  const displayPrice = product.lowestPrice ?? product.price ?? 0;
  const displayStock = product.totalStock ?? product.stock ?? 0;

  return (
    <Card className="@container flex h-full w-full flex-col rounded-md border border-[#E2E8F0] bg-white p-2.5 shadow-sm @xs:p-4">
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded bg-[#F8F9FA] @xs:mb-4">
        <Image
          src={displayImage}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          unoptimized
        />
      </div>

      <h3 className="mb-1 line-clamp-2 text-xs font-medium text-gray-900 @xs:mb-2 @xs:text-sm">
        {product.name}
      </h3>

      <p className="mb-3 text-xs font-medium text-gray-500 @xs:mb-4 @xs:text-sm">
        Price:{" "}
        <span className="text-base font-semibold text-[#007BFF] @xs:text-lg">
          ${Number(displayPrice).toFixed(2)}
        </span>
      </p>

      <p className="mb-3 text-xs font-medium text-gray-500 @xs:mb-4 @xs:text-sm">
        Stock: <span className="font-semibold text-gray-900">{displayStock}</span>
      </p>

      <div className="mt-auto flex flex-row items-center justify-between gap-1 max-[395px]:flex-col max-[395px]:gap-2 @xs:gap-2">
        <QuantitySelector
          initialValue={1}
          onChange={(newQty) => setQuantity(newQty)}
        />
        <Button
          onClick={handleAddToCart}
          disabled={displayStock === 0 || adding}
          className="h-7 w-full flex-1 whitespace-nowrap rounded bg-[#007BFF] px-1 py-1 text-[10px] font-medium text-white hover:bg-[#0056b3] disabled:cursor-not-allowed disabled:bg-slate-300 max-[395px]:h-8 max-[395px]:text-xs @xs:h-9 @xs:px-3 @xs:text-sm flex items-center justify-center gap-1"
        >
          {added ? (
            <>
              <Check className="h-3.5 w-3.5" /> Added!
            </>
          ) : adding ? (
            "Adding..."
          ) : (
            "Add to Cart"
          )}
        </Button>
      </div>
    </Card>
  );
}
