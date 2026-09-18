'use client';

import React, { useState, useEffect, use } from 'react';

import Link from 'next/link';

import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  PlusCircle,
  Search,
  Clock,
  Trash2,
  Loader2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';
import { useSocket } from '@/providers/socket-provider';
import { ROUTES } from '@/constants/routes';
import type { RawImportProductData } from '@/types/product.types';

interface ImportErrorItem {
  id?: string;
  row_index: number;
  product_name?: string;
  error_type?: string;
  error: string;
  product_id?: string;
  resolution_status?: string;
  resolved_at?: string;
  raw_data?: RawImportProductData;
}

interface ImportJobReviewData {
  job: {
    id: string;
    filename: string;
    status: string;
    totalItems: number;
    processedItems: number;
    successfulItems: number;
    failedItems: number;
    createdAt: string;
    completedAt?: string;
  };
  summary: {
    totalFailed: number;
    resolvedCount: number;
    remainingCount: number;
  };
  errors: ImportErrorItem[];
}

function ImportReviewSkeleton() {
  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto pb-32">
      {/* Top Header Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
      </div>

      {/* Summary Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-5 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-7 w-12 rounded-lg" />
            </div>
            <Skeleton className="w-12 h-12 rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-full sm:w-64 rounded-xl" />
      </div>

      {/* List of Error Items Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-16 rounded-lg" />
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <Skeleton className="h-8 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ImportReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const { showSuccess, showError } = useToast();
  const { refreshNotifications } = useSocket();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ImportJobReviewData | null>(null);

  const [filterTab, setFilterTab] = useState<'unresolved' | 'resolved'>('unresolved');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Removing uncreated product state
  const [itemToRemove, setItemToRemove] = useState<ImportErrorItem | null>(null);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);

  const handleConfirmRemove = async () => {
    if (!itemToRemove || !itemToRemove.id) return;

    const itemId = itemToRemove.id;
    try {
      setResolvingItemId(itemId);
      const res = await fetch(`/api/admin/imports/items/${itemId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to remove item from review');
      }

      // Update local state smoothly
      setData((prev) => {
        if (!prev) return prev;
        const updatedErrors = prev.errors.map((err) =>
          err.id === itemId
            ? { ...err, resolution_status: 'RESOLVED', resolved_at: new Date().toISOString() }
            : err
        );
        const resolvedCount = updatedErrors.filter((e) => e.resolution_status === 'RESOLVED').length;
        const remainingCount = Math.max(0, prev.summary.totalFailed - resolvedCount);

        return {
          ...prev,
          summary: {
            ...prev.summary,
            resolvedCount,
            remainingCount
          },
          errors: updatedErrors
        };
      });

      refreshNotifications(true);
      refreshNotifications(false);
      showSuccess('Product removed from import review list.', 'Item Dismissed');
      setItemToRemove(null);
    } catch (err) {
      console.error('Failed to remove item:', err);
      showError((err as Error).message || 'Failed to remove item', 'Error');
    } finally {
      setResolvingItemId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadReviewData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/imports/${id}/review`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to load import review data');
        }

        if (isMounted) {
          setData(json.data);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message || 'Failed to fetch import review details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (id && status === 'authenticated') {
      loadReviewData();
    }

    return () => {
      isMounted = false;
    };
  }, [id, status]);

  if (status === 'loading' || (loading && !data && !error)) {
    return <ImportReviewSkeleton />;
  }

  if (status === 'unauthenticated' || (status === 'authenticated' && session?.user?.role !== 'ADMIN')) {
    return (
      <div className="py-16 text-center text-slate-600 font-medium">
        Access Denied. Please login with an Admin account.
        <Link href={ROUTES.login} className="mt-4 block font-semibold text-blue-600 underline">
          Go to Login
        </Link>
      </div>
    );
  }

  const errors = data?.errors || [];
  const filteredErrors = errors.filter((item) => {
    // 1. Tab filtering
    if (filterTab === 'unresolved' && item.resolution_status === 'RESOLVED') return false;
    if (filterTab === 'resolved' && item.resolution_status !== 'RESOLVED') return false;

    // 2. Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.product_name || '').toLowerCase().includes(q);
      const matchError = (item.error || '').toLowerCase().includes(q);
      const matchType = (item.error_type || '').toLowerCase().includes(q);
      const matchRow = item.row_index.toString().includes(q);
      return matchName || matchError || matchType || matchRow;
    }

    return true;
  });

  const summary = data?.summary || { totalFailed: 0, resolvedCount: 0, remainingCount: 0 };
  const job = data?.job;

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto pb-32">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.adminProducts}
            className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition border border-slate-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Import Error Review
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and correct invalid products from <span className="font-semibold text-slate-700">{job?.filename || 'products.csv'}</span>
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs sm:text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {data && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-50/60 border border-red-200/80 rounded-3xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">Total Failed</span>
                <span className="text-2xl font-black text-red-900 mt-1 block">{summary.totalFailed}</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-3xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Resolved</span>
                <span className="text-2xl font-black text-emerald-900 mt-1 block">{summary.resolvedCount}</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">Remaining to Fix</span>
                <span className="text-2xl font-black text-amber-900 mt-1 block">{summary.remainingCount}</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterTab('unresolved')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterTab === 'unresolved'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
              >
                Unresolved ({summary.remainingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('resolved')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterTab === 'resolved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
              >
                Resolved ({summary.resolvedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products or errors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* List of Error Items */}
          <div className="space-y-4">
            {filteredErrors.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No Error Items in this View</h3>
                <p className="text-xs text-slate-400">
                  {filterTab === 'unresolved'
                    ? 'All products from this import have been resolved!'
                    : 'No items match your active search filter.'}
                </p>
              </div>
            ) : (
              filteredErrors.map((item) => {
                const isResolved = item.resolution_status === 'RESOLVED';
                const rawPrice = item.raw_data?.price;
                const priceFormatted = rawPrice !== undefined && rawPrice !== null && rawPrice !== '' ? `$${rawPrice}` : 'Price not set';
                const categoryFormatted = item.raw_data?.categoryName || item.raw_data?.category || 'Category not set';

                return (
                  <div
                    key={item.id || item.row_index}
                    className={`bg-white border rounded-3xl p-6 transition-all shadow-xs space-y-4 ${isResolved ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    {/* Item Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-black font-mono">
                          Row #{item.row_index}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                          {item.product_name || item.raw_data?.name || 'Unnamed Product'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span>{priceFormatted}</span>
                          <span>•</span>
                          <span>{categoryFormatted}</span>
                        </div>
                      </div>
                    </div>

                    {/* Error Message Box */}
                    <div className="p-3.5 bg-red-50/70 border border-red-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-red-800">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold block uppercase text-[10px] tracking-wider text-red-600">
                          {item.error_type || 'VALIDATION_ERROR'}
                        </span>
                        <span className="leading-relaxed">{item.error}</span>
                      </div>
                    </div>

                    {/* Bottom Action Row */}
                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {isResolved ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                          >
                            <Link href={`/admin/products/edit/${item.product_id}`}>
                              <span>View Active Product</span>
                              <ExternalLink className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        ) : item.product_id ? (
                          <Button
                            size="sm"
                            asChild
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                          >
                            <Link href={`/admin/products/edit/${item.product_id}?importItemId=${item.id}&jobId=${id}`}>
                              <Edit3 className="h-3.5 w-3.5 mr-1" />
                              <span>Fix Product</span>
                            </Link>
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={resolvingItemId === item.id}
                              onClick={() => setItemToRemove(item)}
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-semibold rounded-xl cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              <span>Remove</span>
                            </Button>

                            <Button
                              size="sm"
                              asChild
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                            >
                              <Link href={`/admin/products/new?importItemId=${item.id}&jobId=${id}`}>
                                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                <span>Create & Fix Product</span>
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Confirmation Dialog for Removing Uncreated Product */}
      <AlertDialog open={Boolean(itemToRemove)} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <AlertDialogContent className="sm:max-w-md p-6 rounded-3xl space-y-4">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Remove from Review?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-800">{itemToRemove?.product_name || itemToRemove?.raw_data?.name || 'this product'}</span> (Row #{itemToRemove?.row_index}) from the review list? This product was not added to the catalog and will be dismissed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setItemToRemove(null)}
              disabled={Boolean(resolvingItemId)}
              className="rounded-xl border-slate-200 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRemove}
              disabled={Boolean(resolvingItemId)}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              {resolvingItemId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <span>Yes, Remove</span>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
