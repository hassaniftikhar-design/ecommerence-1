'use client';

import React, { useRef } from 'react';

import Image from 'next/image';

import { Upload, X, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getValidImageUrl } from '@/lib/image-util';

export interface FormImageItem {
  id: string;
  file?: File;
  previewUrl: string;
  colorAssignment: string; // "GLOBAL" or specific color name (e.g. "Blue")
}

interface MultiImageUploadProps {
  images: FormImageItem[];
  onChange: (images: FormImageItem[]) => void;
  availableColors: string[];
  disabled?: boolean;
}

export function MultiImageUpload({
  images,
  onChange,
  availableColors,
  disabled = false
}: MultiImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);

    const newItems: FormImageItem[] = filesArray.map((file, idx) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      colorAssignment: 'GLOBAL'
    }));

    onChange([...images, ...newItems]);
    // Reset file input so same files can be re-selected if deleted
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (id: string) => {
    const target = images.find((img) => img.id === id);
    if (target?.previewUrl && target.file) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(images.filter((img) => img.id !== id));
  };

  const handleColorChange = (id: string, colorAssignment: string) => {
    onChange(
      images.map((img) => (img.id === id ? { ...img, colorAssignment } : img))
    );
  };

  // Deduplicate available colors
  const uniqueColors = Array.from(
    new Set(availableColors.map((c) => c.trim()).filter(Boolean))
  );

  return (
    <div className="space-y-4 w-full">
      {/* Upload Dropzone Box matching screenshot design */}
      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center shadow-xs transition-all cursor-pointer hover:border-[#007BFF] hover:bg-blue-50/20 active:scale-[0.99]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF] mb-3">
          <Upload className="h-6 w-6 stroke-[2]" />
        </div>

        <p className="text-sm font-semibold text-slate-700">
          Upload multiple images
        </p>
        <p className="mt-1 text-xs text-slate-400">
          JPEG, PNG, WEBP, GIF up to 10MB
        </p>
      </div>

      {/* Uploaded Image Cards List */}
      {images.length > 0 && (
        <div className="space-y-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xs transition-all hover:shadow-md"
            >
              {/* Image Preview Container */}
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-slate-100 mb-2">
                <Image
                  src={getValidImageUrl(img.previewUrl)}
                  alt="Uploaded product preview"
                  fill
                  className="object-cover"
                  unoptimized
                />

                {/* Red Delete X Button (Top Right) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(img.id);
                  }}
                  disabled={disabled}
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  title="Remove image"
                >
                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Color Assignment Dropdown Box */}
              <div className="relative">
                <select
                  value={img.colorAssignment}
                  onChange={(e) => handleColorChange(img.id, e.target.value)}
                  disabled={disabled}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#007BFF] focus:bg-white focus:outline-hidden"
                >
                  <option value="GLOBAL">Global (Default)</option>
                  {uniqueColors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
