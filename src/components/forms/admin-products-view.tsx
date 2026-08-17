"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Edit2, Search, ChevronDown, ChevronUp, X } from "lucide-react";
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
import { getProductsPaginated, type ProductsPaginationMeta } from "@/services/product.service";
import { VariantBadge } from "@/components/common/variant-badge";
import type { Product, ProductStatusFilter } from "@/types/product.types";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const { showError } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState<ProductsPaginationMeta>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [addDrawerOpen, setAddDrawerOpen] = useState<boolean>(initialOpenAddDrawer);
  const [editProductId, setEditProductId] = useState<string | null>(initialEditProductId);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Image preview modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    setEditProductId(initialEditProductId);
  }, [initialEditProductId]);

  const toggleRowExpand = (productId: string) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
  };

  const fetchProductsList = async (
    targetPage: number = currentPage,
    targetSearch: string = debouncedSearchQuery,
    targetFilter: ProductStatusFilter = statusFilter
  ) => {
    try {
      setLoading(true);
      const result = await getProductsPaginated({
        page: targetPage,
        limit: 10,
        search: targetSearch,
        status: targetFilter,
      });
      setProducts(result.products);
      setPaginationMeta(result.pagination);
    } catch (err) {
      console.error("Failed to load products:", err);
      showError((err as Error).message || "Failed to load products", "Error");
    } finally {
      setLoading(false);
    }
  };

  // Trigger search / status filter change: reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    fetchProductsList(1, debouncedSearchQuery, statusFilter);
  }, [debouncedSearchQuery, statusFilter]);

  // Page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchProductsList(newPage, debouncedSearchQuery, statusFilter);
  };

  useEffect(() => {
    setAddDrawerOpen(initialOpenAddDrawer);
  }, [initialOpenAddDrawer]);

  const handleCloseAddDrawer = () => {
    setAddDrawerOpen(false);
    onCloseAddDrawer?.();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (filterOpt: ProductStatusFilter) => {
    setStatusFilter(filterOpt);
  };



  if (status !== "loading" && (!session || session.user?.role !== "ADMIN")) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-2 text-slate-600">You must be logged in again to view this page.</p>
        <Link href={ROUTES.login} className="mt-4 inline-block font-semibold text-primary underline">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Search / Action Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#007BFF]">Products</h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">

          <div className="relative w-full sm:w-64 h-9">
            <input
              type="text"
              placeholder="Search product title or category..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-xs sm:text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-[#007BFF]"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 h-9">
            {(["all", "active", "inactive"] as const).map((filterOpt) => (
              <button
                key={filterOpt}
                type="button"
                onClick={() => handleStatusFilterChange(filterOpt)}
                className={cn(
                  "px-3 h-7 flex items-center justify-center text-xs font-semibold rounded-md capitalize transition-all cursor-pointer",
                  statusFilter === filterOpt
                    ? "bg-white text-[#007BFF] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {filterOpt === "all" ? "All" : filterOpt === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={() => setAddDrawerOpen(true)}
            variant="outline"
            className="w-full sm:w-auto h-9 border-[#007BFF] text-[#007BFF] hover:bg-blue-50 font-medium px-4 text-sm cursor-pointer"
          >
            + Add a Single Product
          </Button>

          <Link href={ROUTES.adminAddMultipleProducts} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-9 bg-[#007BFF] hover:bg-blue-600 text-white font-medium px-4 text-sm shadow-sm">
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
              <TableHead className="w-[35%] font-semibold text-slate-600">Title</TableHead>
              <TableHead className="font-semibold text-slate-600">Price</TableHead>
              <TableHead className="font-semibold text-slate-600">Total Stock</TableHead>
              <TableHead className="font-semibold text-slate-600">Variants</TableHead>
              <TableHead className="font-semibold text-slate-600">Status</TableHead>
              <TableHead className="text-right font-semibold text-slate-600 pr-14">Actions</TableHead>
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
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right pr-8"><Skeleton className="h-8 w-28 ml-auto rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                  No products found. Click &quot;+ Add a Single Product&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const displayPrice = product.price ?? product.lowestPrice ?? 0;
                const displayStock = product.totalStock ?? product.stock ?? 0;
                const displayVariantCount = product.variantCount ?? product.variants?.length ?? 1;
                const displayImage = product.imageUrl || product.variants?.[0]?.images?.[0];
                const isExpanded = expandedProductId === product.id;

                return (
                  <React.Fragment key={product.id}>
                    <TableRow
                      onClick={() => toggleRowExpand(product.id)}
                      className={cn(
                        "hover:bg-slate-50/70 border-b border-slate-100 cursor-pointer transition-colors",
                        !product.isActive && "bg-slate-50/40 opacity-85"
                      )}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-start gap-3">
                          <img
                            src={displayImage}
                            alt={product.name}
                            title="Click to view full image"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({ url: displayImage || "", title: product.name });
                            }}
                            className="h-10 w-10 shrink-0 rounded object-cover border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all shadow-2xs"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/placeholder-product.png";
                            }}
                          />
                          <div className="min-w-0">
                            <Tooltip content={product.name} side="top">
                              <p className="text-xs sm:text-sm font-medium text-slate-700 line-clamp-2 cursor-pointer hover:text-[#007BFF] transition-colors">
                                {product.name}
                              </p>
                            </Tooltip>
                            {product.category?.name && (
                              <span className="text-[11px] text-slate-400 block">
                                {product.category.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs sm:text-sm text-slate-700 font-medium">
                        ${Number(displayPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-slate-700 font-medium pl-10">
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

                      <TableCell>
                        {product.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80"
                            title={product.inactiveAt ? `Deactivated: ${new Date(product.inactiveAt).toLocaleString()}` : "Inactive"}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            Inactive
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right pr-16">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditProductId(product.id);
                            }}
                            className="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 cursor-pointer transition shrink-0"
                            title="Edit Product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Variant Breakdown Row */}
                    {isExpanded && (
                      <TableRow className="bg-slate-50/60 border-b border-slate-200">
                        <TableCell colSpan={6} className="p-4 sm:p-5">
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
                                      <div className="flex items-center gap-2.5">
                                        <VariantBadge
                                          color={color !== "Standard" ? color : undefined}
                                          size={size !== "Standard" ? size : undefined}
                                        />
                                        <span className="text-xs font-semibold text-slate-800">
                                          {color !== "Standard" ? color : ""} {size !== "Standard" ? size : ""}
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
      {paginationMeta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500 font-medium">
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {Math.min((paginationMeta.page - 1) * paginationMeta.limit + 1, paginationMeta.totalItems)}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-800">
              {Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.totalItems)}
            </span>{" "}
            of <span className="font-semibold text-slate-800">{paginationMeta.totalItems}</span> products
          </p>
          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs bg-white shadow-2xs">
            <button
              onClick={() => handlePageChange(paginationMeta.page - 1)}
              disabled={!paginationMeta.hasPrevPage}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed border-r border-slate-200 font-medium transition cursor-pointer"
            >
              Previous
            </button>
            {Array.from({ length: paginationMeta.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1.5 font-semibold border-r border-slate-200 last:border-r-0 transition cursor-pointer ${paginationMeta.page === page ? "text-[#007BFF] bg-blue-50/90" : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(paginationMeta.page + 1)}
              disabled={!paginationMeta.hasNextPage}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Lightbox Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          {/* Floating Close Button */}
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[10001] rounded-full p-2.5 bg-black/60 hover:bg-black/90 text-white transition cursor-pointer shadow-2xl border border-white/20"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Full Screen Image View Container */}
          <div
            className="relative flex items-center justify-center w-full h-full max-w-[96vw] max-h-[95vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.url}
              alt="Full size preview"
              className="w-full h-full max-w-[96vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl"
            />
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
