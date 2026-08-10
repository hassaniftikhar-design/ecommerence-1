"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuantitySelector } from "@/components/home/quantity-selector";
import { useToast } from "@/components/ui/toast";
import { addToCart } from "@/services/cart.service";
import { RequireLoginModal } from "@/components/auth/require-login-modal";
import type { Product } from "@/types/product.types";

const DEFAULT_SIZES = ["Small", "Medium", "Large"];
const DEFAULT_COLORS = ["Black", "White", "Red", "Blue"];

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

    const combined = Array.from(new Set([...fromOptions, ...fromVariants]));
    return combined.length > 0 ? combined : DEFAULT_SIZES;
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

    const combined = Array.from(new Set([...fromOptions, ...fromVariants]));
    return combined.length > 0 ? combined : DEFAULT_COLORS;
  }, [product]);

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

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

  const currentPrice =
    matchingVariant?.price ?? product.lowestPrice ?? product.price ?? 0;

  const displayImage =
    matchingVariant?.images?.[0] ||
    product.imageUrl ||
    product.variants?.[0]?.images?.[0] ||
    "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

  const isOutOfStock = currentStock === 0;

  const { showSuccess } = useToast();

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
      alert((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Card className="@container flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md @xs:p-4">
        {/* Top Image Container */}
        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg bg-[#F8F9FA] @xs:mb-4">
          {isOutOfStock && (
            <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-[#DC2626] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm @xs:text-xs">
              Out Of Stock
            </span>
          )}
          <Image
            src={displayImage}
            alt={product.name}
            fill
            className="object-cover"
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

        {/* Select Size and Select Color Dropdowns */}
        <div className="mb-3.5 grid grid-cols-2 gap-2">
          {/* Select Size Dropdown */}
          <div className="relative">
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full h-8 sm:h-9 appearance-none rounded-md border border-slate-200 bg-white px-2.5 pr-7 text-[11px] sm:text-xs font-normal text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#007BFF] cursor-pointer"
            >
              <option value="">Select Size</option>
              {availableSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Select Color Dropdown */}
          <div className="relative">
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full h-8 sm:h-9 appearance-none rounded-md border border-slate-200 bg-white px-2.5 pr-7 text-[11px] sm:text-xs font-normal text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#007BFF] cursor-pointer"
            >
              <option value="">Select Color</option>
              {availableColors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Bottom Quantity & Add to Cart Action Row */}
        <div className="mt-auto flex flex-row items-center justify-between gap-1 max-[395px]:flex-col max-[395px]:gap-2 @xs:gap-2">
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
