"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { getProducts, deleteProduct } from "@/services/product.service";
import type { Product } from "@/types/product.types";

export default function AdminProductsPage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchProductsList = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsList();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(id);
      await fetchProductsList();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading products catalog...</div>;
  }

  if (!session || session.user?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-2 text-slate-600">You must be logged in as an ADMIN to view this page.</p>
        <Link href={ROUTES.login} className="mt-4 inline-block font-semibold text-primary underline">
          Go to Login
        </Link>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const paginatedProducts = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#007BFF]">Products</h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Link href={ROUTES.adminAddSingleProduct} className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-[#007BFF] text-[#007BFF] hover:bg-blue-50 font-medium px-4 py-2 text-sm"
            >
              + Add a Single Product
            </Button>
          </Link>

          <Link href={ROUTES.adminAddMultipleProducts} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-[#007BFF] hover:bg-blue-600 text-white font-medium px-4 py-2 text-sm shadow-sm">
              + Add Multiple Products
            </Button>
          </Link>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 border-b border-slate-200">
              <TableHead className="w-[45%] font-semibold text-slate-600">Title</TableHead>
              <TableHead className="font-semibold text-slate-600">Lowest Price</TableHead>
              <TableHead className="font-semibold text-slate-600">Total Stock</TableHead>
              <TableHead className="font-semibold text-slate-600">Variants</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  No products found. Click &quot;+ Add a Single Product&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const displayPrice = product.lowestPrice ?? product.price ?? 0;
                const displayStock = product.totalStock ?? product.stock ?? 0;
                const displayVariantCount = product.variantCount ?? product.variants?.length ?? 1;
                const displayImage = product.imageUrl || product.variants?.[0]?.images?.[0];

                return (
                  <TableRow key={product.id} className="hover:bg-slate-50/50 border-b border-slate-100">
                    <TableCell className="py-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={displayImage}
                          alt={product.name}
                          className="h-10 w-10 shrink-0 rounded object-cover border border-slate-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-slate-700 line-clamp-2">
                            {product.name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                      ${Number(displayPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                      {displayStock}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm text-slate-600 font-medium">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-[#007BFF]">
                        {displayVariantCount} {displayVariantCount === 1 ? "variant" : "variants"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/products/edit/${product.id}`}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Edit Product"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete Product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Table Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end">
          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 border-r border-slate-200"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 font-medium border-r border-slate-200 last:border-r-0 ${
                  currentPage === page ? "text-[#007BFF] bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
