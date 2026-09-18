'use client';

import React, { useState, useEffect, useRef } from 'react';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  UploadCloud,
  FileSpreadsheet,
  FolderArchive,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Lock,
  Bell
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
import { ROUTES } from '@/constants/routes';
import { useSocket } from '@/providers/socket-provider';
import { getImportJobStatus } from '@/services/product.service';
import type { ImportJobStatus } from '@/types/product.types';

function BulkImportSkeleton() {
  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto pb-24 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-52 rounded-xl" />
      </div>

      {/* Main 2-column cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
          </div>
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
          </div>
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </div>

      {/* Bottom Button Skeleton */}
      <div className="flex justify-end pt-2">
        <Skeleton className="h-12 w-48 rounded-2xl" />
      </div>
    </div>
  );
}

export default function BulkProductUploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { refreshNotifications } = useSocket();

  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [imageFolderCount, setImageFolderCount] = useState<number>(0);

  // In-flight upload & progress state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showSuccessPopup, setShowSuccessPopup] = useState<boolean>(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatusData, setJobStatusData] = useState<ImportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Poll background job status while modal is open
  useEffect(() => {
    if (!showSuccessPopup || !currentJobId) return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const job = await getImportJobStatus(currentJobId);
        if (isMounted && job) {
          setJobStatusData(job);
          if (job.status === 'COMPLETED' || job.status === 'COMPLETED_WITH_ERRORS' || job.status === 'FAILED') {
            refreshNotifications(true);
            refreshNotifications(false);
          }
        }
      } catch (err) {
        console.warn('Failed to poll import job status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [showSuccessPopup, currentJobId, refreshNotifications]);

  // Handle CSV Selection (CSV format only)
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid .csv spreadsheet file.');
      return;
    }

    setError(null);
    setSelectedCsvFile(file);
  };

  // Handle Folder / Images Selection
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validImages = Array.from(files).filter((f) =>
      /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name)
    );

    setSelectedImageFiles(validImages);
    setImageFolderCount(validImages.length);
  };

  // Handle Import Submission
  const handleStartImport = async () => {
    if (!selectedCsvFile) {
      setError('Please select a product CSV file before starting the import.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setUploadProgress(15);
      setJobStatusData(null);

      // Smooth progress animation while network upload is active
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressTimer);
            return 85;
          }
          return prev + 15;
        });
      }, 150);

      const formData = new FormData();
      formData.append('file', selectedCsvFile);

      for (const img of selectedImageFiles) {
        formData.append('images', img);
      }

      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressTimer);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit bulk product import');
      }

      // Upload finished & enqueued
      const returnedJobId = data.data?.jobId || null;
      setCurrentJobId(returnedJobId);
      setUploadProgress(100);
      setSubmitting(false);
      setShowSuccessPopup(true);

      // Immediately refresh notifications
      refreshNotifications(true);
      refreshNotifications(false);
    } catch (err) {
      setError((err as Error).message || 'An unexpected error occurred during submission.');
      setUploadProgress(0);
      setSubmitting(false);
    }
  };

  const handleDone = async () => {
    setShowSuccessPopup(false);
    await refreshNotifications(true);
    await refreshNotifications(false);
    if (currentJobId) {
      router.push(`${ROUTES.adminProducts}?jobId=${currentJobId}`);
    } else {
      router.push(ROUTES.adminProducts);
    }
    router.refresh();
  };

  if (status === 'loading') {
    return <BulkImportSkeleton />;
  }

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

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto pb-24">
      {/* Top Navigation */}
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
              <UploadCloud className="h-6 w-6 text-blue-600" />
              Bulk Product Import
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Asynchronous, durable background catalog upload and processing
            </p>
          </div>
        </div>

        <a
          href="/api/admin/products/bulk/template"
          download="product_bulk_import_template.xlsx"
          className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200/80 px-4 py-2.5 rounded-xl hover:bg-blue-100/70 transition shadow-xs cursor-pointer"
        >
          <Download className="h-4 w-4" /> Download Excel Template (.xlsx)
        </a>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs sm:text-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Main Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: CSV File Dropzone */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
              <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">1</span>
              <span>Select Spreadsheet</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Upload Product CSV File</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Use the Excel template to select from Category, Color, and Size dropdowns, save/export it as a <span className="font-semibold text-slate-700">.csv</span> file, and upload it here.
            </p>
          </div>

          <div
            onClick={() => !submitting && csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${submitting
              ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
              : selectedCsvFile
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
              }`}
          >
            <input
              ref={csvInputRef}
              type="file"
              disabled={submitting}
              accept=".csv, text/csv"
              onChange={handleCsvChange}
              className="hidden"
            />

            {selectedCsvFile ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[220px]">
                    {selectedCsvFile.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {(selectedCsvFile.size / 1024).toFixed(1)} KB • Click to change
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Click to choose or drop CSV file
                  </span>
                  <span className="text-[11px] text-slate-400">Supports .csv format only</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Step 2: Image Folder Dropzone (Disabled until CSV is uploaded) */}
        <div
          className={`bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6 transition-all ${!selectedCsvFile ? 'opacity-60 bg-slate-50/50' : ''
            }`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">2</span>
              <span>Image Assets</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Upload Product Images Folder
              {!selectedCsvFile && <Lock className="h-4 w-4 text-slate-400" />}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              If your CSV references local image filenames, select the folder containing the matching image files.
            </p>
          </div>

          <div
            onClick={() => !submitting && selectedCsvFile && folderInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-3 ${!selectedCsvFile
              ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
              : submitting
                ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
                : imageFolderCount > 0
                  ? 'border-indigo-400 bg-indigo-50/30 cursor-pointer'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 cursor-pointer'
              }`}
          >
            <input
              ref={folderInputRef}
              type="file"
              disabled={submitting || !selectedCsvFile}
              multiple
              // @ts-expect-error webkitdirectory is a non-standard HTML attribute for directory selection
              webkitdirectory=""
              directory=""
              onChange={handleFolderChange}
              className="hidden"
            />

            {!selectedCsvFile ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shadow-xs">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">
                    Upload CSV file first to enable
                  </span>
                  <span className="text-[11px] text-slate-400">JPG, PNG, WEBP, GIF, SVG</span>
                </div>
              </>
            ) : imageFolderCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                  <FolderArchive className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {imageFolderCount} Images Selected
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Images will be uploaded to Cloudinary • Click to change
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                  <FolderArchive className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Click to choose images directory
                  </span>
                  <span className="text-[11px] text-slate-400">JPG, PNG, WEBP, GIF, SVG</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* In-Flight Upload Progress Bar */}
        {submitting && (
          <div className="md:col-span-2 bg-blue-50/70 border border-blue-200 rounded-3xl p-6 sm:p-8 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-blue-950">
                    Uploading to background job scheduler...
                  </h4>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Please wait a moment while your catalog and images are uploaded and enqueued.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-800">{uploadProgress}%</span>
            </div>

            <div className="w-full bg-blue-100/80 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom Action Button (Clean button without big black box) */}
        {!submitting && (
          <div className="md:col-span-2 flex items-center justify-end pt-2">
            <Button
              type="button"
              onClick={handleStartImport}
              disabled={submitting || !selectedCsvFile}
              className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Start Bulk Import</span>
            </Button>
          </div>
        )}
      </div>

      {/* Success Modal Dialog */}
      <AlertDialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
        <AlertDialogContent className="sm:max-w-md p-8 rounded-3xl text-center space-y-6">
          {jobStatusData?.status === 'PROCESSING' || jobStatusData?.status === 'QUEUED' ? (
            <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : jobStatusData?.status === 'COMPLETED_WITH_ERRORS' ? (
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="h-8 w-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          )}

          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-xl font-black text-slate-900">
              {jobStatusData?.status === 'PROCESSING'
                ? 'Processing Products...'
                : jobStatusData?.status === 'COMPLETED'
                  ? 'Import Completed!'
                  : jobStatusData?.status === 'COMPLETED_WITH_ERRORS'
                    ? 'Import Completed with Notes'
                    : 'Import Queued Successfully!'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {jobStatusData?.status === 'PROCESSING' ? (
                <>
                  Processing <span className="font-bold text-slate-900">{jobStatusData.processed_items}</span> of{' '}
                  <span className="font-bold text-slate-900">{jobStatusData.total_items || '...'}</span> products.
                </>
              ) : jobStatusData?.status === 'COMPLETED' ? (
                <>
                  Successfully imported <span className="font-bold text-emerald-700">{jobStatusData.successful_items}</span> products into your catalog.
                </>
              ) : jobStatusData?.status === 'COMPLETED_WITH_ERRORS' ? (
                <>
                  Imported <span className="font-bold text-emerald-700">{jobStatusData.successful_items}</span> products. <span className="font-bold text-amber-700">{jobStatusData.failed_items}</span> items require review.
                </>
              ) : (
                'Your products are queued for background processing. You will receive real-time notifications as items are imported.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="p-3 bg-blue-50/80 border border-blue-200/70 rounded-2xl flex items-center gap-2.5 text-xs text-blue-800 font-medium text-left">
            <Bell className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              {jobStatusData?.status === 'COMPLETED'
                ? 'Catalog has been updated. Click below to view products.'
                : 'You can monitor live progress and error reviews in the notifications bell.'}
            </span>
          </div>

          <AlertDialogFooter className="sm:justify-center pt-2">
            <Button
              type="button"
              onClick={handleDone}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
            >
              {jobStatusData?.status === 'COMPLETED' ? 'View Products' : 'Done'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
