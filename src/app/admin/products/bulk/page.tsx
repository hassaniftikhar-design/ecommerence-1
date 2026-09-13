'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  ArrowRight,
  Clock,
  ExternalLink
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function BulkProductUploadPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [imageFolderCount, setImageFolderCount] = useState<number>(0);

  // In-flight upload & progress state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle CSV Selection
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Please select a valid .csv or .xlsx spreadsheet file.');
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

  // Handle Single Import Submission
  const handleStartImport = async () => {
    if (!selectedCsvFile) {
      setError('Please select a product CSV or Excel file before starting the import.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setUploadProgress(15);

      // Simulate smooth progress while network request is in flight
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

      // Received HTTP 202 Accepted from FastAPI / Backend
      setUploadProgress(100);
      setUploadSuccess(true);
      const jobId = data.data?.jobId || data.data?.taskId || null;
      setQueuedJobId(jobId);
      setAutoRedirectCountdown(3);
    } catch (err) {
      setError((err as Error).message || 'An unexpected error occurred during submission.');
      setUploadProgress(0);
      setUploadSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-redirect countdown effect
  useEffect(() => {
    if (autoRedirectCountdown === null) return;

    if (autoRedirectCountdown <= 0) {
      router.push(ROUTES.adminProducts);
      return;
    }

    const timer = setTimeout(() => {
      setAutoRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoRedirectCountdown, router]);

  const handleCancelAutoRedirect = () => {
    setAutoRedirectCountdown(null);
  };

  const handleReset = () => {
    setSelectedCsvFile(null);
    setSelectedImageFiles([]);
    setImageFolderCount(0);
    setSubmitting(false);
    setUploadProgress(0);
    setUploadSuccess(false);
    setQueuedJobId(null);
    setAutoRedirectCountdown(null);
    setError(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

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
          download="products_bulk_import_template.xlsx"
          className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200/80 px-4 py-2.5 rounded-xl hover:bg-blue-100/70 transition shadow-xs cursor-pointer"
        >
          <Download className="h-4 w-4" /> Download Sample Template (.xlsx)
        </a>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs sm:text-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Main Container */}
      {!uploadSuccess ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: CSV File Dropzone */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
                <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">1</span>
                <span>Select Spreadsheet</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Upload Product Data File</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide your CSV or Excel file containing product titles, prices (&ge; $1.00), stock (&ge; 1), categories, and variant specifications.
              </p>
            </div>

            <div
              onClick={() => !submitting && csvInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                submitting
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
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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
                    <span className="text-[11px] text-slate-400">Supports .csv and .xlsx formats</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 2: Image Folder Dropzone */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">2</span>
                <span>Optional Assets</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Upload Product Images Folder</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                If your CSV references local image filenames, select the folder containing the matching image files.
              </p>
            </div>

            <div
              onClick={() => !submitting && folderInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                submitting
                  ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
                  : imageFolderCount > 0
                  ? 'border-indigo-400 bg-indigo-50/30'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
              }`}
            >
              <input
                ref={folderInputRef}
                type="file"
                disabled={submitting}
                multiple
                // @ts-ignore
                webkitdirectory=""
                directory=""
                onChange={handleFolderChange}
                className="hidden"
              />

              {imageFolderCount > 0 ? (
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

          {/* In-Flight Upload Progress Card */}
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
                      These will upload soon. Please wait a moment while the job is enqueued.
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

          {/* Bottom Action Bar */}
          {!submitting && (
            <div className="md:col-span-2 flex items-center justify-between bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
              <div>
                <h4 className="text-sm font-bold">Ready to import?</h4>
                <p className="text-xs text-slate-300">
                  Products will be queued and processed in the background by Celery.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleStartImport}
                disabled={submitting || !selectedCsvFile}
                className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>Start Bulk Import</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Upload Finished & Queued Successfully Screen */
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 animate-in zoom-in-95 duration-200 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">
              Products Queued Successfully!
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your catalog has been submitted to the job queue and will upload soon.
            </p>
          </div>

          {/* Progress Bar Reached 100% */}
          <div className="space-y-2 text-left bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Upload & Enqueue Status</span>
              <span className="text-emerald-600 font-bold">100% Completed</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Celery workers are importing your products into the catalog in the background.
            </p>
          </div>

          {/* Backend Validation Notice */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-left flex items-start gap-3 text-xs text-amber-900">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Validation & Error Handling</span>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                If any product fails validation (missing title, price &lt; $1.00, stock &lt; 1, or missing category), an admin notification will be generated so you can review and fix them at any time.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {autoRedirectCountdown !== null && (
              <Button
                variant="outline"
                onClick={handleCancelAutoRedirect}
                className="w-full sm:w-auto rounded-xl border-slate-200 text-slate-700 text-xs font-semibold h-11 px-5"
              >
                Stay on Page ({autoRedirectCountdown}s)
              </Button>
            )}

            <Button
              onClick={() => router.push(ROUTES.adminProducts)}
              className="w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-11 px-8 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Products</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
