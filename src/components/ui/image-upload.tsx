'use client';

import React, { useRef, useState, type ChangeEvent } from 'react';

import Image from 'next/image';

import { Upload as UploadIcon, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { uploadImage } from '@/services/product.service';
import { cn } from '@/lib/utils';

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
  className
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
      setError((err as Error).message || 'Image upload failed');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
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
    <div className={cn('space-y-2', className)}>
      <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50 min-h-[220px] w-full md:w-56 shrink-0 transition hover:border-slate-300">
        {primaryImage ? (
          <div className="space-y-3 w-full text-center">
            <div className="relative h-28 w-28 mx-auto rounded-lg overflow-hidden border border-slate-200 group">
              <Image
                src={primaryImage}
                alt="Product preview"
                fill
                className="object-cover"
                sizes="112px"
                unoptimized
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(0)}
                disabled={disabled}
                className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold gap-1 z-10"
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
              <RefreshCw
                className={cn('h-3.5 w-3.5', uploading && 'animate-spin')}
              />
              {uploading ? 'Replacing...' : 'Change Image'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              {uploading ? (
                <RefreshCw className="h-5 w-5 animate-spin text-[#007BFF]" />
              ) : (
                <UploadIcon className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                {uploading ? 'Uploading image...' : 'Click to upload image'}
              </p>
              <p className="text-[11px] text-slate-500">PNG, JPG, WebP up to 5MB</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTrigger}
              disabled={disabled || uploading}
              className="mt-2 text-xs font-semibold h-7 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Browse
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

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
