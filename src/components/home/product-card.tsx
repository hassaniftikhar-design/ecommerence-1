"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuantitySelector } from "@/components/home/quantity-selector";
import { ProductColorSelector } from "@/components/home/product-color-selector";
import { ProductSizeSelector } from "@/components/home/product-size-selector";
import { useToast } from "@/components/ui/toast";
import { addToCart } from "@/services/cart.service";
import { RequireLoginModal } from "@/components/auth/require-login-modal";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product.types";

export function ProductCard({ product }: { product: Product }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Extract unique sizes from variants and options
  const availableSizes = useMemo(() => {
    const fromOptions =
      product.options
        ?.find((o) => o.name.toLowerCase() === "size")
        ?.values.map((v) => v.value) || [];

    const fromVariants =
      product.variants
        ?.map(
          (v) =>
            v.attributes?.Size ||
            v.attributes?.size ||
            v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === "size")
              ?.value
        )
        .filter((val): val is string => Boolean(val)) || [];

    return Array.from(new Set([...fromOptions, ...fromVariants]));
  }, [product]);

  // Extract unique colors from variants and options
  const availableColors = useMemo(() => {
    const fromOptions =
      product.options
        ?.find((o) => o.name.toLowerCase() === "color")
        ?.values.map((v) => v.value) || [];

    const fromVariants =
      product.variants
        ?.map(
          (v) =>
            v.attributes?.Color ||
            v.attributes?.color ||
            v.variantOptions?.find(
              (vo) => vo.optionName.toLowerCase() === "color"
            )?.value
        )
        .filter((val): val is string => Boolean(val)) || [];

    return Array.from(new Set([...fromOptions, ...fromVariants]));
  }, [product]);

  const [selectedSize, setSelectedSize] = useState<string>(availableSizes[0] || "");
  const [selectedColor, setSelectedColor] = useState<string>(availableColors[0] || "");

  type SlideDirection = "left" | "right";
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("right");
  const [animationKey, setAnimationKey] = useState<number>(0);

  // Handle color selection with dynamic directional slide animation calculation
  const handleSelectColor = (newColor: string) => {
    if (!newColor || newColor.toLowerCase() === selectedColor.toLowerCase()) {
      return;
    }

    const currentColorIndex = availableColors.findIndex(
      (c) => c.toLowerCase() === selectedColor.toLowerCase()
    );
    const newColorIndex = availableColors.findIndex(
      (c) => c.toLowerCase() === newColor.toLowerCase()
    );

    if (
      currentColorIndex !== -1 &&
      newColorIndex !== -1 &&
      currentColorIndex !== newColorIndex
    ) {
      // Calculate dynamic slide direction based on ordered color index comparison
      const direction: SlideDirection =
        newColorIndex > currentColorIndex ? "right" : "left";
      setSlideDirection(direction);
      setAnimationKey((prev) => prev + 1);
    }

    setSelectedColor(newColor);
  };

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Automatically update selected color/size if available lists change
  useEffect(() => {
    if (availableColors.length > 0 && (!selectedColor || !availableColors.includes(selectedColor))) {
      setSelectedColor(availableColors[0] || "");
    }
  }, [availableColors, selectedColor]);

  useEffect(() => {
    if (availableSizes.length > 0 && (!selectedSize || !availableSizes.includes(selectedSize))) {
      setSelectedSize(availableSizes[0] || "");
    }
  }, [availableSizes, selectedSize]);

  // Find matching variant based on selected size and color
  const matchingVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return null;

    return (
      product.variants.find((v) => {
        const colorAttr = (
          v.attributes?.Color ||
          v.attributes?.color ||
          v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === "color")
            ?.value ||
          ""
        ).toLowerCase();

        const sizeAttr = (
          v.attributes?.Size ||
          v.attributes?.size ||
          v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === "size")
            ?.value ||
          ""
        ).toLowerCase();

        const matchColor =
          !selectedColor || colorAttr === selectedColor.toLowerCase();
        const matchSize =
          !selectedSize || sizeAttr === selectedSize.toLowerCase();

        return matchColor && matchSize;
      }) || null
    );
  }, [product.variants, selectedColor, selectedSize]);

  // Find color variant image if specific image exists for chosen color
  const colorVariantImage = useMemo(() => {
    if (!selectedColor || !product.variants) return null;
    const match = product.variants.find((v) => {
      const colorAttr = (
        v.attributes?.Color ||
        v.attributes?.color ||
        v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === "color")?.value ||
        ""
      ).toLowerCase();
      return colorAttr === selectedColor.toLowerCase() && v.images && v.images.length > 0;
    });
    return match?.images?.[0] || null;
  }, [product.variants, selectedColor]);

  // Compute current stock based on selection
  const currentStock = useMemo(() => {
    if (product.variants && product.variants.length > 0) {
      if (selectedColor && selectedSize) {
        return matchingVariant ? matchingVariant.stock : 0;
      }
      if (selectedColor || selectedSize) {
        const filtered = product.variants.filter((v) => {
          const colorAttr = (
            v.attributes?.Color ||
            v.attributes?.color ||
            v.variantOptions?.find(
              (vo) => vo.optionName.toLowerCase() === "color"
            )?.value ||
            ""
          ).toLowerCase();
          const sizeAttr = (
            v.attributes?.Size ||
            v.attributes?.size ||
            v.variantOptions?.find(
              (vo) => vo.optionName.toLowerCase() === "size"
            )?.value ||
            ""
          ).toLowerCase();

          const matchColor =
            !selectedColor || colorAttr === selectedColor.toLowerCase();
          const matchSize =
            !selectedSize || sizeAttr === selectedSize.toLowerCase();
          return matchColor && matchSize;
        });
        return filtered.reduce((acc, v) => acc + v.stock, 0);
      }
      return product.totalStock ?? product.variants.reduce((acc, v) => acc + v.stock, 0);
    }
    return product.totalStock ?? product.stock ?? 0;
  }, [product, selectedColor, selectedSize, matchingVariant]);

  const currentPrice = product.price ?? product.lowestPrice ?? 0;

  const displayImage =
    colorVariantImage ||
    matchingVariant?.images?.[0] ||
    product.imageUrl ||
    product.variants?.[0]?.images?.[0] ||
    "/placeholder-product.png";

  const isOutOfStock = currentStock === 0;

  const { showSuccess, showError } = useToast();

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    try {
      setAdding(true);
      const targetVariantId = matchingVariant?.id || product.variants?.[0]?.id;
      await addToCart(product.id, targetVariantId, quantity);
      showSuccess("Item added to cart successfully!");
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      showError((err as Error).message || "Failed to add item to cart", "Cart Error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Card className="@container flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md @xs:p-4">
        {/* Top Image Container */}
        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-none bg-[#F8F9FA] @xs:mb-4">
          {isOutOfStock && (
            <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-[#DC2626] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm @xs:text-xs">
              Out Of Stock
            </span>
          )}
          <Image
            key={animationKey}
            src={displayImage}
            alt={product.name}
            fill
            className={cn(
              "object-cover",
              animationKey > 0 &&
                (slideDirection === "right"
                  ? "animate-slide-in-from-right"
                  : "animate-slide-in-from-left")
            )}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        </div>

        {/* Product Title */}
        <h3 className="mb-2 line-clamp-2 text-xs font-medium text-slate-900 leading-snug @xs:text-sm">
          {product.name}
        </h3>

        {/* Price & Stock Row */}
        <div className="mb-3 flex items-center justify-between gap-1 @xs:mb-4">
          <p className="text-xs font-medium text-gray-500 @xs:text-sm">
            Price:{" "}
            <span className="text-base font-semibold text-[#007BFF] @xs:text-lg">
              ${Number(currentPrice).toFixed(2)}
            </span>
          </p>

          {isOutOfStock ? (
            <span className="text-xs font-semibold text-red-500 @xs:text-sm">
              Out Of Stock
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#10B981] @xs:text-sm">
              {currentStock} Items Left
            </span>
          )}
        </div>

        {/* Modular Variant Selectors (Color Swatches & Size Chips/Dropdowns in single row) */}
        {availableColors.length > 1 || availableSizes.length > 1 ? (
          <div
            className={cn(
              "mb-3.5 grid gap-3 items-start",
              availableColors.length > 1 && availableSizes.length > 1
                ? "grid-cols-2"
                : "grid-cols-1"
            )}
          >
            <ProductColorSelector
              colors={availableColors}
              selectedColor={selectedColor}
              onSelectColor={handleSelectColor}
            />
            <ProductSizeSelector
              sizes={availableSizes}
              selectedSize={selectedSize}
              onSelectSize={setSelectedSize}
            />
          </div>
        ) : (
          <div className="mb-3.5 flex items-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span className="text-slate-800 font-bold capitalize">Standard size & color</span>
            </span>
          </div>
        )}

        {/* Bottom Quantity & Add to Cart Action Row */}
        <div className="mt-auto flex flex-row items-center justify-between gap-1 max-[395px]:flex-col max-[395px]:gap-2 @xs:gap-2 pt-1">
          <QuantitySelector
            initialValue={1}
            max={currentStock}
            onChange={(newQty) => setQuantity(newQty)}
          />
          <Button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className="h-7 w-full flex-1 whitespace-nowrap rounded bg-[#007BFF] px-1 py-1 text-[10px] font-medium text-white hover:bg-[#0056b3] disabled:cursor-not-allowed disabled:bg-slate-300 max-[395px]:h-8 max-[395px]:text-xs @xs:h-9 @xs:px-3 @xs:text-sm flex items-center justify-center gap-1 cursor-pointer"
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

      <RequireLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Login Required"
        description="Please log in to your account to add items to your shopping cart."
      />
    </>
  );
}
