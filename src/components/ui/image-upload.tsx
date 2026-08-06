"use client";

import React, { useRef, useState, type ChangeEvent } from "react";
import { Upload as UploadIcon, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/services/product.service";
import { cn } from "@/lib/utils";

export interface ImageUploadProps {
  value?: string[];
  onChange: (value: string[]) => void;
  onRemove?: (url: string) => void;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
}

export function ImageUpload({
  value = [],
  onChange,
  onRemove,
  disabled = false,
  maxFiles = 1,
  className,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const url = await uploadImage(file);

      if (maxFiles === 1) {
        onChange([url]);
      } else {
        onChange([...value, url]);
      }
    } catch (err) {
      setError((err as Error).message || "Image upload failed");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    const removedUrl = value[index];
    const newValues = value.filter((_, i) => i !== index);
    onChange(newValues);
    if (onRemove && removedUrl) {
      onRemove(removedUrl);
    }
  };

  const primaryImage = value[0];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50 min-h-[220px] w-full md:w-56 shrink-0 transition hover:border-slate-300">
        {primaryImage ? (
          <div className="space-y-3 w-full text-center">
            <div className="relative h-28 w-28 mx-auto rounded-lg overflow-hidden border border-slate-200 group">
              <img
                src={primaryImage}
                alt="Product preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(0)}
                disabled={disabled}
                className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold gap-1"
                title="Remove image"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
            <p className="text-xs text-emerald-600 font-semibold truncate max-w-full">
              Image Uploaded
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleTrigger}
              disabled={disabled || uploading}
              className="w-full text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 h-8"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", uploading && "animate-spin")} />
              {uploading ? "Uploading..." : "Change Image"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 flex flex-col items-center w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#007BFF]">
              <UploadIcon className="h-6 w-6" />
            </div>
            <Button
              type="button"
              onClick={handleTrigger}
              disabled={disabled || uploading}
              className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-medium px-4 py-2 text-sm shadow-sm"
            >
              {uploading ? "Uploading..." : "Upload Image"}
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
