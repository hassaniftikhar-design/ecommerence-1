"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VariantImageUploadProps {
  file?: File;
  previewUrl?: string;
  onChange: (file?: File, previewUrl?: string) => void;
  disabled?: boolean;
}

export function VariantImageUpload({
  file,
  previewUrl,
  onChange,
  disabled = false,
}: VariantImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const localUrl = URL.createObjectURL(selectedFile);
    onChange(selectedFile, localUrl);
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl && file) {
      URL.revokeObjectURL(previewUrl);
    }
    onChange(undefined, undefined);
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {previewUrl ? (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-blue-300 bg-blue-50/50 cursor-pointer group shadow-2xs hover:border-[#007BFF]"
          title="Change variant image"
        >
          <Image
            src={previewUrl}
            alt="Variant thumbnail"
            fill
            className="object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:scale-110 cursor-pointer"
            title="Remove variant image"
          >
            <X className="h-2.5 w-2.5 stroke-[3]" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "flex h-11 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-[#007BFF] hover:text-[#007BFF] hover:bg-blue-50/30 transition-all cursor-pointer shadow-2xs active:scale-95",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title="Add optional variant image"
        >
          <ImagePlus className="h-4 w-4 stroke-[2]" />
          <span className="text-[11px] whitespace-nowrap">+ Image</span>
        </button>
      )}
    </div>
  );
}
