'use client';

import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Upload as UploadIcon, FileText, Trash2, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function AddMultipleProductsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a CSV or JSON file to upload.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Simulate parsing/processing bulk upload
      await new Promise((res) => setTimeout(res, 1200));

      setSuccessMsg(`File "${selectedFile.name}" processed successfully!`);
      setTimeout(() => {
        router.push(ROUTES.adminProducts);
      }, 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Please Login again.
        <Link href={ROUTES.login} className="mt-4 inline-block font-semibold text-primary underline">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Top Heading */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.adminProducts}
          className="text-[#0B192C] hover:text-[#007BFF] transition"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-[#0B192C]">Add Multiple Products</h1>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drag & Drop File Container */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#007BFF]">
              <UploadIcon className="h-6 w-6" />
            </div>

            <p className="text-base font-semibold text-slate-700">
              Drop your file here to upload
            </p>

            <button
              type="button"
              onClick={() => {
                const csvData = 'Title,Price,Stock,Category\nSample Product,99.99,10,General';
                const blob = new Blob([csvData], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sample_products.csv';
                a.click();
              }}
              className="mt-1 text-xs text-[#007BFF] underline hover:text-blue-700 font-medium"
            >
              Download Sample File
            </button>

            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleTriggerFileInput}
                className="border-[#007BFF] text-[#007BFF] hover:bg-blue-50 font-semibold px-8 py-2 text-sm"
              >
                Browse
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Uploaded Files Section */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Uploaded Files</h3>

            {selectedFile ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-white">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {selectedFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-slate-50 text-slate-400 text-xs">
                <span>No file selected yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload File Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!selectedFile || uploading}
            className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold px-8 py-2.5 text-sm rounded-lg shadow-sm"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </Button>
        </div>
      </form>
    </div>
  );
}
