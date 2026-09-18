'use client';

import React, { useRef } from 'react';

import Image from 'next/image';

import {
  Trash2,
  Plus,
  AlertCircle,
  AlertTriangle,
  Upload as UploadIcon,
  CheckCircle2,
  Package,
  ImagePlus
} from 'lucide-react';

import { Input } from '@/components/ui/input';

import { Button } from '@/components/ui/button';

import { getValidImageUrl } from '@/lib/image-util';
import { getColorHex, COLOR_OPTIONS, SIZE_OPTIONS } from '@/constants/generalconstants';
import type { GroupedProduct, ParsedVariant } from '@/lib/bulk-import-parser';

interface BulkProductCardProps {
  product: GroupedProduct;
  index: number;
  categoryOptions: string[];
  onUpdateProductField: (productId: string, field: 'title' | 'price' | 'categoryName', value: string | number) => void;
  onUpdateVariantField: (productId: string, variantId: string, field: keyof ParsedVariant, value: string | number) => void;
  onAddVariant: (productId: string) => void;
  onRemoveVariant: (productId: string, variantId: string) => void;
  onRemoveProduct: (productId: string) => void;
  onUploadVariantImage: (productId: string, variantId: string, file: File) => Promise<void>;
  onUploadDefaultImage: (productId: string, file: File) => Promise<void>;
}

export function BulkProductCard({
  product,
  index,
  categoryOptions,
  onUpdateProductField,
  onUpdateVariantField,
  onAddVariant,
  onRemoveVariant,
  onRemoveProduct,
  onUploadVariantImage,
  onUploadDefaultImage
}: BulkProductCardProps) {
  const defaultImageInputRef = useRef<HTMLInputElement>(null);
  const variantImageInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const defaultImgPreview =
    product.defaultImage.cloudinaryUrl ||
    product.defaultImage.previewUrl ||
    product.variants[0]?.cloudinaryUrl ||
    product.variants[0]?.previewUrl ||
    '';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-slate-300">
      {/* Product Card Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 px-6 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs">
            #{index + 1}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">
              {product.title || 'Untitled Product'}
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              <Package className="h-3.5 w-3.5" />
              {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemoveProduct(product.id)}
          className="text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs h-8 px-2.5"
          title="Delete this entire product"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Remove Product
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Warnings Banner (Split Products) */}
        {product.warnings.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Notice:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {product.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Blocking Errors Banner */}
        {product.errors.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Validation Errors:</div>
              <ul className="list-disc list-inside space-y-0.5 text-red-700">
                {product.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Top Product Details Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Default Product Image Box */}
          <div className="md:col-span-3 flex flex-col items-center">
            <div className="relative aspect-square w-full max-w-[180px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden group shadow-2xs">
              {defaultImgPreview ? (
                <>
                  <Image
                    src={getValidImageUrl(defaultImgPreview)}
                    alt={product.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div
                    onClick={() => defaultImageInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-xs font-semibold"
                  >
                    Change Default Image
                  </div>
                </>
              ) : (
                <div
                  onClick={() => defaultImageInputRef.current?.click()}
                  className="w-full h-full flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 cursor-pointer p-4 text-center transition"
                >
                  <ImagePlus className="h-8 w-8 mb-1.5 stroke-[1.5]" />
                  <span className="text-[11px] font-medium">Add Default Image</span>
                </div>
              )}
            </div>

            <input
              ref={defaultImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUploadDefaultImage(product.id, file);
                }
              }}
            />

            <span className="mt-2 text-[11px] text-slate-400 font-medium text-center">
              Primary Product Image
            </span>
          </div>

          {/* Product Fields */}
          <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Title */}
            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Product Title *
              </label>
              <Input
                type="text"
                value={product.title}
                onChange={(e) => onUpdateProductField(product.id, 'title', e.target.value)}
                placeholder="e.g. Classic Oversized Tee"
                className="h-9.5 text-sm font-medium"
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Base Price ($) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={product.price}
                onChange={(e) => onUpdateProductField(product.id, 'price', parseFloat(e.target.value) || 0)}
                placeholder="29.99"
                className="h-9.5 text-sm font-medium"
              />
            </div>

            {/* Category - restricted to existing categories */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Category *
              </label>
              <select
                value={product.categoryName}
                onChange={(e) => onUpdateProductField(product.id, 'categoryName', e.target.value)}
                className="flex h-9.5 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="" disabled>Select existing category</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Variants Matrix Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Product Variants ({product.variants.length})
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddVariant(product.id)}
              className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Variant
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[150px]">Color *</th>
                  <th className="py-2.5 px-3 w-28">Size *</th>
                  <th className="py-2.5 px-3 w-24">Stock *</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Variant Image</th>
                  <th className="py-2.5 px-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.variants.map((v, vIdx) => {
                  const variantHex = v.colorHex || getColorHex(v.colorName);
                  const vImgPreview = v.cloudinaryUrl || v.previewUrl || '';

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">
                        {vIdx + 1}
                      </td>

                      {/* Color Dropdown (Restricted to COLOR_OPTIONS) */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                            style={{ backgroundColor: variantHex || '#94A3B8' }}
                            title={variantHex ? `Hex: ${variantHex}` : 'Standard / No Color'}
                          />
                          <select
                            value={v.colorName}
                            onChange={(e) => {
                              onUpdateVariantField(product.id, v.id, 'colorName', e.target.value);
                              onUpdateVariantField(product.id, v.id, 'colorHex', getColorHex(e.target.value));
                            }}
                            className="h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-hidden"
                          >
                            <option value="">None (Standard)</option>
                            {COLOR_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Size Dropdown (Restricted to SIZE_OPTIONS) */}
                      <td className="py-2 px-3">
                        <select
                          value={v.sizeName}
                          onChange={(e) => onUpdateVariantField(product.id, v.id, 'sizeName', e.target.value)}
                          className="h-8 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-hidden"
                        >
                          <option value="">None (Standard)</option>
                          {SIZE_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Stock */}
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) => onUpdateVariantField(product.id, v.id, 'stock', parseInt(e.target.value, 10) || 0)}
                          placeholder="10"
                          className="h-8 text-xs"
                        />
                      </td>

                      {/* Variant Image & Match Status */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {vImgPreview ? (
                            <div className="relative h-8 w-8 rounded-md border border-slate-200 bg-slate-100 overflow-hidden shrink-0 shadow-2xs">
                              <Image
                                src={getValidImageUrl(vImgPreview)}
                                alt={`${v.colorName} ${v.sizeName}`}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-slate-300 shrink-0">
                              <ImagePlus className="h-4 w-4" />
                            </div>
                          )}

                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="truncate text-[11px] font-mono text-slate-600">
                              {v.imagePath || 'No image attached'}
                            </span>
                            {v.imageMatchStatus === 'matched' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Matched local file
                              </span>
                            )}
                            {v.imageMatchStatus === 'unmatched' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                                <AlertTriangle className="h-3 w-3" /> Unmatched file
                              </span>
                            )}
                            {v.imageMatchStatus === 'collision' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-medium">
                                <AlertCircle className="h-3 w-3" /> Ambiguous filename collision
                              </span>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => variantImageInputRefs.current[v.id]?.click()}
                            className="h-7 px-2 text-[11px] border-slate-200 hover:bg-slate-100 shrink-0"
                            title="Upload/replace image for this variant"
                          >
                            <UploadIcon className="h-3 w-3 text-slate-600" />
                          </Button>
                          <input
                            ref={(el) => {
                              variantImageInputRefs.current[v.id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                onUploadVariantImage(product.id, v.id, file);
                              }
                            }}
                          />
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          disabled={product.variants.length <= 1}
                          onClick={() => onRemoveVariant(product.id, v.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed transition"
                          title={product.variants.length <= 1 ? 'Product must have at least one variant' : 'Delete variant'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
