"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Edit2, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddProductDrawer } from "@/components/forms/add-product-drawer";
import { ROUTES } from "@/constants/routes";
import { getProducts, deleteProduct } from "@/services/product.service";
import type { Product } from "@/types/product.types";

export interface AdminProductsViewProps {
  initialOpenAddDrawer?: boolean;
  initialEditProductId?: string | null;
  onCloseAddDrawer?: () => void;
  onCloseEditDrawer?: () => void;
}

export function AdminProductsView({
  initialOpenAddDrawer = false,
  initialEditProductId = null,
  onCloseAddDrawer,
  onCloseEditDrawer,
}: AdminProductsViewProps = {}) {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [addDrawerOpen, setAddDrawerOpen] = useState<boolean>(initialOpenAddDrawer);
  const [editProductId, setEditProductId] = useState<string | null>(initialEditProductId);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const pageSize = 10;

  useEffect(() => {
    setEditProductId(initialEditProductId);
  }, [initialEditProductId]);

  const toggleRowExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

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

  useEffect(() => {
    setAddDrawerOpen(initialOpenAddDrawer);
  }, [initialOpenAddDrawer]);

  const handleCloseAddDrawer = () => {
    setAddDrawerOpen(false);
    onCloseAddDrawer?.();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(id);
      await fetchProductsList();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (status !== "loading" && (!session || session.user?.role !== "ADMIN")) {
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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category?.name && product.category.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header & Search / Action Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#007BFF]">Products</h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search product title or category..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs sm:text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-[#007BFF]"
            />
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <Button
            type="button"
            onClick={() => setAddDrawerOpen(true)}
            variant="outline"
            className="w-full sm:w-auto border-[#007BFF] text-[#007BFF] hover:bg-blue-50 font-medium px-4 py-2 text-sm cursor-pointer"
          >
            + Add a Single Product
          </Button>

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
              <TableHead className="font-semibold text-slate-600">Price</TableHead>
              <TableHead className="font-semibold text-slate-600">Total Stock</TableHead>
              <TableHead className="font-semibold text-slate-600">Variants</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedProducts.length === 0 ? (
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
                const isExpanded = expandedProductIds.has(product.id);

                return (
                  <React.Fragment key={product.id}>
                    <TableRow
                      onClick={() => toggleRowExpand(product.id)}
                      className="hover:bg-slate-50/70 border-b border-slate-100 cursor-pointer transition-colors"
                    >
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
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-blue-50 text-[#007BFF] hover:bg-blue-100 transition">
                          <span>
                            {displayVariantCount} {displayVariantCount === 1 ? "variant" : "variants"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-[#007BFF]" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-[#007BFF]" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditProductId(product.id);
                            }}
                            className="text-blue-500 hover:text-blue-700 p-1 cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(product.id, e)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Variant Breakdown Row */}
                    {isExpanded && (
                      <TableRow className="bg-slate-50/60 border-b border-slate-200">
                        <TableCell colSpan={5} className="p-4 sm:p-5">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Variant Breakdown ({displayVariantCount})
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {product.variants && product.variants.length > 0 ? (
                                product.variants.map((variant, idx) => {
                                  const color =
                                    variant.attributes?.Color ||
                                    variant.attributes?.color ||
                                    variant.variantOptions?.find(
                                      (vo) => vo.optionName.toLowerCase() === "color"
                                    )?.value ||
                                    "Standard";
                                  const size =
                                    variant.attributes?.Size ||
                                    variant.attributes?.size ||
                                    variant.variantOptions?.find(
                                      (vo) => vo.optionName.toLowerCase() === "size"
                                    )?.value ||
                                    "Standard";

                                  return (
                                    <div
                                      key={variant.id || idx}
                                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-800">
                                          Color:{" "}
                                          <span className="text-[#007BFF] font-bold">
                                            {color}
                                          </span>
                                        </span>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-xs font-semibold text-slate-800">
                                          Size:{" "}
                                          <span className="text-slate-900 font-bold">
                                            {size}
                                          </span>
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-xs">
                                        Qty: {variant.stock}
                                      </span>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-xs text-slate-400 italic">
                                  No variant details available
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
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

      {/* Add Product Drawer Slider (696px width) */}
      <AddProductDrawer
        isOpen={addDrawerOpen}
        onClose={handleCloseAddDrawer}
        mode="create"
        onSuccess={fetchProductsList}
      />

      {/* Edit Product Drawer Slider (696px width) */}
      <AddProductDrawer
        isOpen={!!editProductId}
        onClose={() => {
          setEditProductId(null);
          onCloseEditDrawer?.();
        }}
        mode="edit"
        productId={editProductId}
        onSuccess={fetchProductsList}
      />
    </div>
  );
}
