"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuantitySelector } from "@/components/home/quantity-selector";
import type { Product } from "@/types/product.types";

export function ProductCard({ product }: { product: Product }) {
  const handleAddToCart = () => {
    // TODO(backend-integration): call addToCart endpoint
  };

  return (
    <Card className="@container flex h-full w-full flex-col rounded-md border border-[#E2E8F0] bg-white p-2.5 shadow-sm @xs:p-4">
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded bg-[#F8F9FA] @xs:mb-4">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>

      <h3 className="mb-1 line-clamp-2 text-xs font-medium text-gray-900 @xs:mb-2 @xs:text-sm">
        {product.name}
      </h3>

      <p className="mb-3 text-xs font-medium text-gray-500 @xs:mb-4 @xs:text-sm">
        Price:{" "}
        <span className="text-base font-semibold text-[#007BFF] @xs:text-lg">
          ${product.price.toFixed(2)}
        </span>
      </p>

      <p className="mb-3 text-xs font-medium text-gray-500 @xs:mb-4 @xs:text-sm">
        Stock: <span className="font-semibold text-gray-900">{product.stock}</span>
      </p>

      <div className="mt-auto flex flex-row items-center justify-between gap-1 max-[395px]:flex-col max-[395px]:gap-2 @xs:gap-2">
        <QuantitySelector initialValue={1} />
        <Button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="h-7 w-full flex-1 whitespace-nowrap rounded bg-[#007BFF] px-1 py-1 text-[10px] font-medium text-white hover:bg-[#0056b3] disabled:cursor-not-allowed disabled:bg-slate-300 max-[395px]:h-8 max-[395px]:text-xs @xs:h-9 @xs:px-3 @xs:text-sm"
        >
          Add to Cart
        </Button>
      </div>
    </Card>
  );
}
