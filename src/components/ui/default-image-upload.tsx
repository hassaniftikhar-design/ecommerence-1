"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { Upload as UploadIcon, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DefaultImageUploadProps {
  file?: File;
  previewUrl?: string;
  onChange: (file?: File, previewUrl?: string) => void;
  disabled?: boolean;
}

export function DefaultImageUpload({
  file,
  previewUrl,
  onChange,
  disabled = false,
}: DefaultImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTrigger = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const localUrl = URL.createObjectURL(selectedFile);
    onChange(selectedFile, localUrl);

    if (e.target) {
      e.target.value = "";
    }
  };

  const handleRemove = () => {
    if (previewUrl && file) {
      URL.revokeObjectURL(previewUrl);
    }
    onChange(undefined, undefined);
  };

  return (
    <div className="space-y-2 w-full">
      <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center bg-white min-h-[220px] w-full md:w-56 shrink-0 transition hover:border-[#007BFF] shadow-xs">
        {previewUrl ? (
          <div className="space-y-3 w-full text-center">
            <div className="relative aspect-square w-32 mx-auto rounded-xl overflow-hidden border border-slate-200 group shadow-xs">
              <Image
                src={previewUrl}
                alt="Default product preview"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-110 cursor-pointer"
                title="Remove default image"
              >
                <X className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTrigger}
              disabled={disabled}
              className="w-full text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 h-8 rounded-lg cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Change Default Image
            </Button>
          </div>
        ) : (
          <div className="space-y-3 flex flex-col items-center w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF]">
              <UploadIcon className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Upload Default Image *</p>
              <p className="text-[11px] text-slate-400 mt-0.5">JPEG, PNG, WEBP up to 10MB</p>
            </div>
            <Button
              type="button"
              onClick={handleTrigger}
              disabled={disabled}
              className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-semibold px-4 py-2 text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Choose Main Image
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
