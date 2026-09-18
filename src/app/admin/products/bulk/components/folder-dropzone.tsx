'use client';

import React, { useRef, useState } from 'react';

import {
  Upload as UploadIcon,
  FolderUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Loader2,
  FileCheck2
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

import type { FolderImageIndex } from '@/lib/bulk-import-parser';

interface FolderDropzoneProps {
  onCsvSelected: (file: File) => void;
  onFolderSelected: (files: FileList | File[]) => void;
  selectedCsvFile: File | null;
  csvRowCount: number;
  folderIndex: FolderImageIndex | null;
  totalImagesCount: number;
  parsingCsv: boolean;
  onResetAll: () => void;
}

export function FolderDropzone({
  onCsvSelected,
  onFolderSelected,
  selectedCsvFile,
  csvRowCount,
  folderIndex,
  totalImagesCount,
  parsingCsv,
  onResetAll
}: FolderDropzoneProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const res = await fetch('/api/admin/products/bulk/template');
      if (!res.ok) {
        throw new Error('Failed to generate template');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_bulk_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template error:', err);
      alert('Could not download XLSX template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.files;
    if (!items || items.length === 0) return;

    const files = Array.from(items);
    const csvFile = files.find((f) => f.name.toLowerCase().endsWith('.csv'));
    const imageFiles = files.filter((f) =>
      /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name)
    );

    if (csvFile) {
      onCsvSelected(csvFile);
    }
    if (imageFiles.length > 0) {
      onFolderSelected(imageFiles);
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCsvSelected(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFolderSelected(files);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const collisionCount = folderIndex?.collisionFilenames.size || 0;

  return (
    <div className="space-y-4">
      {/* Top action row: Download template button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 rounded-2xl border border-blue-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">
              Bulk Import Template (.xlsx)
            </h4>
            <p className="text-xs text-slate-500">
              Includes canonical dropdowns (Categories, Colors, Sizes) and Color Reference sheet.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700 font-semibold text-xs flex items-center gap-2 shadow-xs shrink-0"
        >
          {downloadingTemplate ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              Generating XLSX...
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5 text-blue-600" />
              Download XLSX Template
            </>
          )}
        </Button>
      </div>

      {/* Dual Upload Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed bg-white p-6 sm:p-8 transition-all',
          isDragging
            ? 'border-blue-500 bg-blue-50/40 ring-4 ring-blue-500/10'
            : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Left Column: CSV Upload */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50/80 border border-slate-200/80 p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <UploadIcon className="h-6 w-6" />
            </div>

            <h3 className="text-sm font-bold text-slate-800">
              1. Upload CSV File *
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">
              Excel &quot;Save As CSV&quot; file with grouped product rows, colors, and sizes.
            </p>

            {selectedCsvFile ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 font-medium">
                <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[180px] font-semibold">
                  {selectedCsvFile.name}
                </span>
                <span className="text-[11px] text-emerald-600">
                  ({csvRowCount} rows)
                </span>
              </div>
            ) : null}

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={parsingCsv}
                onClick={() => csvInputRef.current?.click()}
                className="border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs px-4"
              >
                {parsingCsv ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Parsing...
                  </>
                ) : selectedCsvFile ? (
                  'Change CSV File'
                ) : (
                  'Browse CSV File'
                )}
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvChange}
              />
            </div>
          </div>

          {/* Right Column: Folder Upload */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50/80 border border-slate-200/80 p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <FolderUp className="h-6 w-6" />
            </div>

            <h3 className="text-sm font-bold text-slate-800">
              2. Upload Images Folder (Optional)
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">
              Select folder of local images. Filenames match row <code className="text-indigo-700 font-mono">imagePath</code>.
            </p>

            {totalImagesCount > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs text-indigo-800 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>{totalImagesCount} image files loaded</span>
                </div>
                {collisionCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1 font-medium">
                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                    {collisionCount} ambiguous filename collision{collisionCount === 1 ? '' : 's'} across subfolders
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs px-4"
              >
                {totalImagesCount > 0 ? 'Change Images Folder' : 'Select Folder of Images'}
              </Button>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-expect-error directory and webkitdirectory are supported browser attributes
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleFolderChange}
              />
            </div>
          </div>
        </div>

        {/* Bottom bar inside dropzone if files loaded */}
        {(selectedCsvFile || totalImagesCount > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">
              Tip: Drag and drop your CSV and image files directly into this box at any time.
            </span>
            <button
              type="button"
              onClick={onResetAll}
              className="text-slate-500 hover:text-red-600 font-medium flex items-center gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" /> Clear & Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
