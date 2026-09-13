'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Edit3,
  PlusCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

interface ImportErrorItem {
  id?: string;
  row_index: number;
  product_name?: string;
  error_type?: string;
  error: string;
  product_id?: string;
  resolution_status?: string;
  resolved_at?: string;
  raw_data?: any;
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

export default function ImportReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ImportJobReviewData | null>(null);

  const [filterTab, setFilterTab] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

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

    if (id) {
      loadReviewData();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (session?.user?.role !== 'ADMIN') {
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

        <a
          href={`/api/admin/imports/${id}/export-errors`}
          download={`import_errors_${id}.csv`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <Download className="h-4 w-4 text-slate-500" /> Download Error Report (CSV)
        </a>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs sm:text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading import error items...</span>
        </div>
      ) : data ? (
        <>
          {/* Job Overview Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">File Import</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {job?.status || 'COMPLETED_WITH_ERRORS'}
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{job?.filename || 'products.csv'}</h2>
              <p className="text-xs text-slate-300">
                Total Products: <span className="font-bold text-white">{job?.totalItems ?? 0}</span> • Successful: <span className="font-bold text-emerald-400">{job?.successfulItems ?? 0}</span> • Failed: <span className="font-bold text-red-400">{job?.failedItems ?? 0}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="text-[11px] text-slate-400 block">Job ID</span>
                <span className="text-xs font-mono font-bold text-slate-200">{id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'unresolved'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Unresolved ({summary.remainingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                All Failed ({summary.totalFailed})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('resolved')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'resolved'
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
                const isExpanded = expandedRow === item.row_index;
                const rawPrice = item.raw_data?.price;
                const priceFormatted = rawPrice !== undefined && rawPrice !== null && rawPrice !== '' ? `$${rawPrice}` : 'Price not set';
                const categoryFormatted = item.raw_data?.categoryName || item.raw_data?.category || 'Category not set';

                return (
                  <div
                    key={item.id || item.row_index}
                    className={`bg-white border rounded-3xl p-6 transition-all shadow-xs space-y-4 ${
                      isResolved ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-slate-300'
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

                      <div className="flex items-center gap-2">
                        {/* Status Badges */}
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          Status: INACTIVE
                        </span>

                        {isResolved ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Resolution: RESOLVED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                            Resolution: OPEN
                          </span>
                        )}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : item.row_index)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Raw Data' : 'Inspect Imported Data'}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

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
                        )}
                      </div>
                    </div>

                    {/* Collapsible Raw Data Preview */}
                    {isExpanded && item.raw_data && (
                      <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 space-y-1 animate-in fade-in">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Imported Row Raw Payload
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-[11px]">
                          {JSON.stringify(item.raw_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
