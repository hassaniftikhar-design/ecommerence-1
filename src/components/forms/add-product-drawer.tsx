"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { ProductForm } from "@/components/forms/product-form";
import { getProductById } from "@/services/product.service";
import type { Product } from "@/types/product.types";
import { cn } from "@/lib/utils";

interface AddProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  productId?: string | null;
  onSuccess?: () => void;
}

export function AddProductDrawer({
  isOpen,
  onClose,
  mode = "create",
  productId,
  onSuccess,
}: AddProductDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [productData, setProductData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch product details in edit mode
  useEffect(() => {
    if (!isOpen || mode !== "edit" || !productId) {
      setProductData(null);
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    async function fetchDetail() {
      if (!productId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getProductById(productId);
        if (isSubscribed) {
          setProductData(data);
        }
      } catch (err) {
        if (isSubscribed) {
          setError((err as Error).message);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    fetchDetail();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen, mode, productId]);

  if (!isOpen || !mounted) return null;

  const isEditLoading = mode === "edit" && (loading || !productData);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Right-Side Slider Drawer Container (Exact width 696px, Full height 100vh) */}
      <div
        className={cn(
          "relative z-[10000] flex flex-col h-screen h-full bg-[#F8FAFC] shadow-2xl border-l border-slate-200 overflow-hidden transition-all duration-300 ease-in-out animate-in slide-in-from-right",
          "w-full max-w-[696px]"
        )}
      >
        {/* Top Header Bar */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 text-lg font-bold text-[#007BFF] hover:text-blue-700 transition"
            >
              <ArrowLeft className="h-5 w-5" />{" "}
              {mode === "edit" ? "Edit Product" : "Add a Single Product"}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEditLoading ? (
            <div className="py-20 text-center text-slate-400 font-medium">
              Loading product details...
            </div>
          ) : mode === "edit" && error ? (
            <div className="rounded-lg bg-red-50 p-4 text-xs font-semibold text-red-600 border border-red-200">
              {error}
            </div>
          ) : (
            <ProductForm
              key={mode === "edit" ? productId : "create"}
              mode={mode}
              initialData={mode === "edit" ? productData || undefined : undefined}
              onSubmitSuccess={() => {
                onSuccess?.();
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
