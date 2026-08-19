"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VariantImageUploadProps {
  file?: File;
  previewUrl?: string;
  defaultImageUrl?: string;
  onChange: (file?: File, previewUrl?: string) => void;
  disabled?: boolean;
}

export function VariantImageUpload({
  file,
  previewUrl,
  defaultImageUrl,
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

  const effectivePreview = previewUrl || defaultImageUrl;
  const isCustom = Boolean(previewUrl);

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

      {effectivePreview ? (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border bg-white cursor-pointer group shadow-2xs transition-all hover:scale-105",
            isCustom ? "border-blue-400 ring-2 ring-blue-400/20" : "border-slate-200 hover:border-[#007BFF]"
          )}
          title={isCustom ? "Custom color image (Click to change)" : "Using Default Product Image (Click to add custom color image)"}
        >
          <Image
            src={effectivePreview}
            alt="Variant thumbnail"
            fill
            className="object-cover"
            unoptimized
          />
          {isCustom ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:scale-110 cursor-pointer"
              title="Remove custom color image (revert to default)"
            >
              <X className="h-2.5 w-2.5 stroke-[3]" />
            </button>
          ) : (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[9px] font-bold text-white bg-black/60 px-1 py-0.5 rounded">
                +Custom
              </span>
            </div>
          )}
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
          title="Add color image"
        >
          <ImagePlus className="h-4 w-4 stroke-[2]" />
          <span className="text-[11px] whitespace-nowrap">+ Image</span>
        </button>
      )}
    </div>
  );
}
