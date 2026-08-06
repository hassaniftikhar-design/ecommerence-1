"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";

import { ProductForm } from "@/components/forms/product-form";
import { ROUTES } from "@/constants/routes";

export default function AddSingleProductPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="py-12 text-center text-slate-500 font-medium">
        Loading...
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
        <h1 className="text-2xl font-bold text-[#0B192C]">Add a Single Product</h1>
      </div>

      <hr className="border-slate-200" />

      {/* Reusable Product Form */}
      <ProductForm mode="create" />
    </div>
  );
}
