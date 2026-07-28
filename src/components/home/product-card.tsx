"use client";

// Client Component: holds the per-card quantity state and the
// (placeholder) add-to-cart click handler. The image/name/price above
// it are static, but they live in the same component as the
// interactive controls because they're never rendered independently of
// them -- splitting them out would just be indirection without reuse.
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuantitySelector } from "@/components/home/quantity-selector";
import type { Product } from "@/types/product.types";

export function ProductCard({ product }: { product: Product }) {
  const handleAddToCart = () => {
    // TODO(backend-integration): call
    // product.service.ts#addToCart(product.id, quantity) once a real
    // cart/session exists.
  };

  return (
    <Card className="flex flex-col p-4">
      <div className="relative mb-4 h-48 w-full overflow-hidden rounded bg-surface-page">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
      </div>

      <h3 className="mb-2 line-clamp-2 text-sm font-medium text-ink">
        {product.name}
      </h3>

      <p className="mb-4 text-sm text-muted">
        Price: <span className="font-semibold text-primary">${product.price.toFixed(2)}</span>
      </p>

      <div className="mt-auto flex items-center gap-3">
        <QuantitySelector initialValue={product.quantity} />
        <Button onClick={handleAddToCart} className="flex-1">
          Add to Cart
        </Button>
      </div>
    </Card>
  );
}
