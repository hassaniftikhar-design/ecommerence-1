'use client';

import React, { useRef } from 'react';

import Image from 'next/image';

import { Upload, X, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { getValidImageUrl } from '@/lib/image-util';

interface ColorImageUploadProps {
  colorName: string;
  file?: File;
  previewUrl?: string;
  onChange: (file?: File, previewUrl?: string) => void;
  disabled?: boolean;
}

export function ColorImageUpload({
  colorName,
  file,
  previewUrl,
  onChange,
  disabled = false
}: ColorImageUploadProps) {
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
      e.target.value = '';
    }
  };

  const handleRemove = () => {
    if (previewUrl && file) {
      URL.revokeObjectURL(previewUrl);
    }
    onChange(undefined, undefined);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 shadow-2xs">
      {/* Color Name Badge */}
      <div className="flex items-center gap-2 min-w-[100px]">
        <span
          className="h-4 w-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
          style={{
            backgroundColor: colorName.toLowerCase() === 'white' ? '#FFFFFF' : colorName.toLowerCase()
          }}
        />
        <span className="text-xs font-bold text-slate-800">{colorName}</span>
      </div>

      {/* Image Preview or Upload Button */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        {previewUrl ? (
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-blue-300 bg-white shadow-2xs">
              <Image
                src={getValidImageUrl(previewUrl)}
                alt={`${colorName} preview`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTrigger}
              disabled={disabled}
              className="h-8 px-2.5 text-[11px] font-semibold border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Change
            </Button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 transition cursor-pointer"
              title={`Remove ${colorName} image`}
            >
              <X className="h-4 w-4 stroke-[2]" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTrigger}
            disabled={disabled}
            className="h-8 px-3 text-[11px] font-semibold border-dashed border-slate-300 bg-white text-slate-700 hover:border-[#007BFF] hover:text-[#007BFF] hover:bg-blue-50/30 transition-all cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5 text-[#007BFF]" />
            + Add {colorName} Image
          </Button>
        )}
      </div>
    </div>
  );
}
