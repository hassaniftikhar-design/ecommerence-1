"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";

import { ProductForm } from "@/components/forms/product-form";
import { ROUTES } from "@/constants/routes";
import { getProductById } from "@/services/product.service";
import type { Product } from "@/types/product.types";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();

  const [loadingProduct, setLoadingProduct] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingProduct(true);
        setError(null);
        const prod = await getProductById(id);
        setProduct(prod);
      } catch (err) {
        setError((err as Error).message || "Failed to load product");
      } finally {
        setLoadingProduct(false);
      }
    }
    loadData();
  }, [id]);

  if (status === "loading" || loadingProduct) {
    return (
      <div className="py-12 text-center text-slate-500 font-medium">
        Loading product details...
      </div>
    );
  }

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-6 w-full max-w-5xl mx-auto pb-12">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.adminProducts}
            className="text-[#0B192C] hover:text-[#007BFF] transition"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-[#0B192C]">Edit Product</h1>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 font-medium border border-red-200">
          {error || "Product not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-12">
      {/* Heading with Arrow */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.adminProducts}
          className="text-[#0B192C] hover:text-[#007BFF] transition"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-[#0B192C]">Edit a Single Product</h1>
      </div>

      <hr className="border-slate-200" />

      {/* Reusable Product Form in Edit mode */}
      <ProductForm mode="edit" initialData={product} />
    </div>
  );
}
