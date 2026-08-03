"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload as UploadIcon, Check } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import { createProduct, uploadImage } from "@/services/product.service";

export default function AddSingleProductPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [categoryName, setCategoryName] = useState("General");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const priceNum = parseFloat(price);
    const stockNum = parseInt(quantity, 10);

    if (!name || isNaN(priceNum) || priceNum <= 0 || isNaN(stockNum) || stockNum < 0) {
      setError("Please enter a valid product name, price, and quantity.");
      return;
    }

    try {
      setSubmitting(true);
      await createProduct({
        name,
        price: priceNum,
        stock: stockNum,
        categoryName: categoryName.trim() || "General",
        imageUrl: imageUrl.trim() || undefined,
      });

      setSuccessMsg("Product created successfully!");
      setTimeout(() => {
        router.push(ROUTES.adminProducts);
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
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

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 font-medium flex items-center gap-2">
          <Check className="h-4 w-4" /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="pt-2">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Left Upload Dotted Box */}
          <div className="w-full md:w-56 shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50 min-h-[220px]">
            {imageUrl ? (
              <div className="space-y-3 w-full">
                <img
                  src={imageUrl}
                  alt="Product preview"
                  className="h-28 w-28 mx-auto rounded-lg object-cover border border-slate-200"
                />
                <p className="text-xs text-emerald-600 font-semibold truncate max-w-full">
                  Image Ready
                </p>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#007BFF]">
                  <UploadIcon className="h-6 w-6" />
                </div>
                <label className="w-full cursor-pointer">
                  <Button
                    type="button"
                    className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-medium px-6 py-2 text-sm"
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Right Inputs Column */}
          <div className="flex-1 w-full space-y-5">
            <div>
              <FormField
                label="Product Name"
                name="name"
                placeholder="Cargo Trousers for Men - 6 Pocket Trousers - 6 Pocket Cargo Trousers in all Colors - Cargo Trouser"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Price"
                name="price"
                type="number"
                step="0.01"
                placeholder="$00.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <FormField
                label="Quantity"
                name="quantity"
                type="number"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div>
              <FormField
                label="Category Name (Optional)"
                name="categoryName"
                placeholder="e.g. Apparel, Electronics"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={submitting || uploading}
                className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold px-8 py-2.5 text-sm rounded-lg shadow-sm"
              >
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
