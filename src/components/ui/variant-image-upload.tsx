'use client';

import React, { useRef } from 'react';

import Image from 'next/image';

import { ImagePlus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getValidImageUrl } from '@/lib/image-util';

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
  disabled = false
}: VariantImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const localUrl = URL.createObjectURL(selectedFile);
    onChange(selectedFile, localUrl);
    if (e.target) {
      e.target.value = '';
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
    <div className="relative inline-flex items-center justify-center shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {previewUrl ? (
        <div className="relative h-11 w-11 shrink-0">
          <div
            onClick={() => !disabled && inputRef.current?.click()}
            className={cn(
              'relative h-11 w-11 overflow-hidden rounded-xl border border-blue-400 bg-white cursor-pointer group shadow-2xs transition-all hover:ring-2 hover:ring-blue-400/30 active:scale-95',
              disabled && 'cursor-not-allowed'
            )}
            title="Change variant image"
          >
            <Image
              src={getValidImageUrl(previewUrl)}
              alt="Variant thumbnail"
              fill
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-1.5 -right-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-xs hover:bg-red-600 hover:scale-110 cursor-pointer transition-transform"
              title="Remove variant image"
            >
              <X className="h-2.5 w-2.5 stroke-[3]" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:border-[#007BFF] hover:text-[#007BFF] hover:bg-blue-50/30 transition-all cursor-pointer shadow-2xs active:scale-95',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          title="Upload variant image"
        >
          <ImagePlus className="h-5 w-5 stroke-[1.75]" />
        </button>
      )}
    </div>
  );
}
