'use client';

import React, { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/ui/toast';
import { ROUTES, COLOR_OPTIONS, SIZE_OPTIONS, DEFAULT_PRODUCT_IMAGE } from '@/constants';
import { DefaultImageUpload } from '@/components/ui/default-image-upload';
import { VariantImageUpload } from '@/components/ui/variant-image-upload';
import { uploadImage, createProduct, updateProduct, getCategories, activateProduct, deactivateProduct } from '@/services/product.service';
import { productFormSchema, type ProductFormSchemaValues } from '@/lib/validators';
import { generateProductCode, generateDefaultSku, replaceSkuProductCode } from '@/lib/sku-util';
import type { Product, ProductFormProps } from '@/types/product.types';
import { cn } from '@/lib/utils';

interface ColorImageItem {
  file?: File;
  previewUrl?: string;
}

export function ProductForm({ mode, initialData, onSubmitSuccess }: ProductFormProps) {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formErrorMessages, setFormErrorMessages] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string }[]>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [productCodeConflictError, setProductCodeConflictError] = useState<string | null>(null);
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);
  const [totalStockError, setTotalStockError] = useState<string | null>(null);

  // Color-based image map: { "Red": { file, previewUrl }, "Blue": { file, previewUrl } }
  const [colorImages, setColorImages] = useState<Record<string, ColorImageItem>>({});

  // Product Active / Inactive status tracking
  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive !== undefined ? initialData.isActive : true
  );
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<'activate' | 'deactivate' | null>(null);

  useEffect(() => {
    if (initialData?.isActive !== undefined) {
      setIsActive(initialData.isActive);
    }
  }, [initialData?.isActive]);

  const handleStatusSelectChange = (newVal: string) => {
    setStatusChangeError(null);
    if (mode === 'create') {
      setIsActive(newVal === 'Active');
      return;
    }

    if (newVal === 'Inactive' && isActive) {
      setPendingStatusChange('deactivate');
    } else if (newVal === 'Active' && !isActive) {
      setPendingStatusChange('activate');
    }
  };

  const confirmStatusChange = async () => {
    if (!initialData?.id || !pendingStatusChange) return;

    try {
      setTogglingStatus(true);
      setStatusChangeError(null);
      if (pendingStatusChange === 'deactivate') {
        await deactivateProduct(initialData.id);
        setIsActive(false);
        showSuccess('Product deactivated successfully!', 'Status Updated');
      } else {
        await activateProduct(initialData.id);
        setIsActive(true);
        showSuccess('Product restored successfully!', 'Status Updated');
      }
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      setStatusChangeError((err as Error).message || 'Failed to update product status');
    } finally {
      setTogglingStatus(false);
      setPendingStatusChange(null);
    }
  };

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await getCategories();
        setDbCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    loadCategories();
  }, []);

  // Quick variant addition state
  const [draftColor, setDraftColor] = useState('');
  const [draftSize, setDraftSize] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [draftSku, setDraftSku] = useState('');
  const [isManualSku, setIsManualSku] = useState(false);
  const [isManualProductCode, setIsManualProductCode] = useState(mode === 'edit');
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftQtyInputRef = React.useRef<HTMLInputElement>(null);

  // Initialize color images when in edit mode with existing variants
  useEffect(() => {
    if (mode === 'edit' && initialData && initialData.variants) {
      const primaryUrl = initialData.imageUrl || initialData.variants?.[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;
      const extracted: Record<string, ColorImageItem> = {};

      for (const v of initialData.variants) {
        const color =
          v.attributes?.Color ||
          v.attributes?.color ||
          v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === 'color')?.value;

        if (color) {
          const customImg = (v.images && v.images.length > 0 && v.images[0]) ? v.images[0] : null;
          const targetImg = customImg || primaryUrl;
          if (targetImg && !extracted[color]) {
            extracted[color] = { previewUrl: targetImg };
          }
        }
      }

      setColorImages(extracted);
    }
  }, [mode, initialData]);

  // Compute default values from initialData (both for edit mode and pre-filled create mode)
  const getDefaultValues = React.useCallback((): ProductFormSchemaValues => {
    if (initialData) {
      const primaryUrl = initialData.imageUrl || initialData.variants?.[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;
      const prodCode = initialData.productCode || generateProductCode(initialData.name, initialData.category?.name || 'General');

      const formattedVariants =
        initialData.variants && initialData.variants.length > 0
          ? initialData.variants.map((v) => {
            const color =
              v.attributes?.Color ||
              v.attributes?.color ||
              v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === 'color')
                ?.value ||
              '';
            const size =
              v.attributes?.Size ||
              v.attributes?.size ||
              v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === 'size')
                ?.value ||
              '';
            return {
              id: v.id,
              sku: v.sku || generateDefaultSku(prodCode, color, size),
              color: color || 'Black',
              size: size || 'M',
              quantity: v.stock > 0 ? v.stock : 1
            };
          })
          : [
            {
              sku: generateDefaultSku(prodCode, 'Black', 'M'),
              color: 'Black',
              size: 'M',
              quantity: (initialData.stock && initialData.stock > 0) ? initialData.stock : 5
            }
          ];

      return {
        name: initialData.name || '',
        productCode: prodCode,
        categoryName: initialData.category?.name || 'General',
        price: initialData.lowestPrice ?? initialData.price ?? ('' as unknown as number),
        defaultImageUrl: primaryUrl,
        variants: formattedVariants
      };
    }

    return {
      name: '',
      productCode: '',
      categoryName: 'General',
      price: '' as unknown as number,
      defaultImageUrl: '',
      variants: []
    };
  }, [initialData]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm<ProductFormSchemaValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultValues()
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants'
  });

  const [savedDropdownCategory, setSavedDropdownCategory] = useState<string>(
    initialData?.category?.name ? initialData.category.name : 'General'
  );

  // Sync form when initialData loads asynchronously
  useEffect(() => {
    if (initialData) {
      reset(getDefaultValues());
      if (initialData.category?.name) {
        setSavedDropdownCategory(initialData.category.name);
      }
      setIsManualProductCode(true);
    }
  }, [initialData, getDefaultValues, reset]);

  // Auto-generate productCode dynamically as user types title (in create mode or if not manually overridden)
  const watchedProductCode = watch('productCode') || '';
  const watchedName = watch('name') || '';
  const watchedCategory = watch('categoryName') || '';

  const updateAllVariantSkusWithNewProductCode = React.useCallback(
    (newCode: string) => {
      if (!newCode || !newCode.trim()) return;
      const currentVariants = watch('variants') || [];
      const updated = currentVariants.map((v) => ({
        ...v,
        sku: replaceSkuProductCode(v.sku, newCode)
      }));
      setValue('variants', updated, { shouldValidate: false });
      const autoSku = generateDefaultSku(newCode, draftColor, draftSize);
      setDraftSku(autoSku);
    },
    [watch, setValue, draftColor, draftSize]
  );

  useEffect(() => {
    if (!isManualProductCode && mode === 'create') {
      if (watchedName && watchedName.trim()) {
        const timer = setTimeout(async () => {
          try {
            const res = await fetch(
              `/api/products/code-check?title=${encodeURIComponent(watchedName)}&category=${encodeURIComponent(watchedCategory)}`
            );
            const data = await res.json();
            if (data.success && data.data?.nextAvailableCode) {
              const autoCode = data.data.nextAvailableCode;
              setValue('productCode', autoCode, { shouldValidate: true });
              updateAllVariantSkusWithNewProductCode(autoCode);
              setProductCodeConflictError(null);
            }
          } catch (err) {
            console.error('Failed to fetch next product code', err);
          }
        }, 300);

        return () => clearTimeout(timer);
      }
    }
  }, [watchedName, watchedCategory, isManualProductCode, mode, setValue, updateAllVariantSkusWithNewProductCode]);

  // Auto-generate draft SKU when draftColor, draftSize, or productCode changes
  useEffect(() => {
    if (!isManualSku) {
      const currentCode = watchedProductCode || (watchedName ? generateProductCode(watchedName, watchedCategory) : 'PROD-001');
      const autoSku = generateDefaultSku(currentCode, draftColor, draftSize);
      setDraftSku(autoSku);
    }
  }, [watchedProductCode, watchedName, watchedCategory, draftColor, draftSize, isManualSku]);

  const [customCategoryError, setCustomCategoryError] = useState<string | null>(null);

  const validateCustomCategory = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setCustomCategoryError('Category name is required.');
      return false;
    }
    const duplicate = dbCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setCustomCategoryError(`Category "${duplicate.name}" already exists.`);
      return false;
    }
    setCustomCategoryError(null);
    return true;
  };

  const handleSwitchToAddMode = () => {
    const currentVal = watch('categoryName');
    if (currentVal && !isCustomCategory) {
      setSavedDropdownCategory(currentVal);
    }
    setIsCustomCategory(true);
    setValue('categoryName', '');
    setCustomCategoryError(null);
  };

  const handleSwitchToDropdownMode = () => {
    setIsCustomCategory(false);
    setValue('categoryName', savedDropdownCategory || 'General');
    setCustomCategoryError(null);
  };

  // Calculate Total Stock automatically as sum of variant quantities
  const watchedVariants = watch('variants') || [];
  const totalStock = watchedVariants.reduce((sum, v) => {
    const qty = Number(v?.quantity);
    return sum + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);

  // Helper to update color image state for a color
  const handleColorImageChange = (colorName: string, file?: File, previewUrl?: string) => {
    if (!colorName) return;
    setColorImages((prev) => {
      const updated = { ...prev };
      if (!file && !previewUrl) {
        delete updated[colorName];
      } else {
        updated[colorName] = { file, previewUrl };
      }
      return updated;
    });
  };

  // Quick Add Variant handler
  const handleAddDraftVariant = () => {
    setDraftError(null);
    let qtyNum = parseInt(draftQty, 10);
    if (isNaN(qtyNum) || qtyNum < 0) {
      qtyNum = 0;
    }

    const colorVal = (draftColor || '').trim();
    const sizeVal = (draftSize || '').trim();
    const currentCode = watchedProductCode || generateProductCode(watchedName, watchedCategory);
    let finalSku = (draftSku || '').trim().toUpperCase();
    if (!finalSku) {
      finalSku = generateDefaultSku(currentCode, colorVal, sizeVal);
    }

    // Duplicate check for variants (color+size combination)
    const isDuplicate = watchedVariants.some(
      (v) =>
        (v.color || '').trim().toLowerCase() === colorVal.toLowerCase() &&
        (v.size || '').trim().toLowerCase() === sizeVal.toLowerCase()
    );

    if (isDuplicate) {
      setDraftError(
        !colorVal && !sizeVal
          ? 'General variant already exists'
          : 'Variant with specified color and size already exists'
      );
      return;
    }

    // Duplicate check for SKU within variant list
    const isDuplicateSku = watchedVariants.some(
      (v) => (v.sku || '').trim().toUpperCase() === finalSku
    );

    if (isDuplicateSku) {
      setDraftError(`SKU '${finalSku}' is already assigned to another variant in this list. Please enter a unique SKU.`);
      return;
    }

    append({
      sku: finalSku,
      color: colorVal,
      size: sizeVal,
      quantity: qtyNum
    });

    // Reset draft fields
    setDraftColor('');
    setDraftSize('');
    setDraftQty('');
    setIsManualSku(false);
    setDraftSku('');

    setTimeout(() => {
      draftQtyInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveVariant = (index: number) => {
    if (fields.length <= 1) {
      setFormErrorMessages([
        'A product must have at least one variant. To delete or remove this product from the store, please deactivate the product.'
      ]);
      return;
    }
    remove(index);
  };

  const onInvalid = () => {
    // Client-side validation errors are automatically bound to form fields via react-hook-form errors.
    setFormErrorMessages([]);
  };

  const onSubmit = async (data: ProductFormSchemaValues) => {
    try {
      setSubmitting(true);
      setProductCodeConflictError(null);
      setTotalStockError(null);
      setCustomCategoryError(null);
      clearErrors();
      setFormErrorMessages([]);

      if (data.price === undefined || data.price === null || isNaN(data.price) || data.price <= 0) {
        setError('price', { type: 'manual', message: 'Price is required and must be greater than 0' });
        setSubmitting(false);
        return;
      }

      if (totalStock <= 0) {
        setTotalStockError('Total Quantity cannot be zero');
        setError('variants', { type: 'manual', message: 'Total Quantity cannot be zero' });
        setSubmitting(false);
        return;
      }

      // 1. Upload mandatory Default Product Image if a new file was selected
      let finalDefaultImageUrl = data.defaultImageUrl || '';
      if (data.defaultImageFile) {
        finalDefaultImageUrl = await uploadImage(data.defaultImageFile);
      }

      if (!finalDefaultImageUrl) {
        setError('defaultImageUrl', { type: 'manual', message: 'Default Product Image is required' });
        setSubmitting(false);
        return;
      }

      // 2. Upload color-specific images to Cloudinary (deferred upload pipeline)
      const finalColorImageUrls: Record<string, string> = {};
      for (const [colorName, state] of Object.entries(colorImages)) {
        if (state.file) {
          const uploadedUrl = await uploadImage(state.file);
          finalColorImageUrls[colorName] = uploadedUrl;
        } else if (state.previewUrl) {
          finalColorImageUrls[colorName] = state.previewUrl;
        }
      }

      // 3. Format variants: Assign color-specific image if present, else fallback to Default Product Image
      let formattedVariants = [];
      const options = [];

      if (data.variants && data.variants.length > 0) {
        const uniqueColors = Array.from(
          new Set(data.variants.map((v) => (v.color || '').trim()).filter(Boolean))
        );
        const uniqueSizes = Array.from(
          new Set(data.variants.map((v) => (v.size || '').trim()).filter(Boolean))
        );

        if (uniqueColors.length > 0) options.push({ name: 'Color', values: uniqueColors });
        if (uniqueSizes.length > 0) options.push({ name: 'Size', values: uniqueSizes });

        formattedVariants = data.variants.map((v) => {
          const colorKey = (v.color || '').trim();
          const attributes: Record<string, string> = {};
          if (colorKey) attributes.Color = colorKey;
          if (v.size?.trim()) attributes.Size = v.size.trim();

          const customColorUrl = finalColorImageUrls[colorKey];
          let variantImages: string[] = [];

          if (customColorUrl && customColorUrl.trim() && customColorUrl.trim() !== finalDefaultImageUrl) {
            variantImages = [customColorUrl.trim(), finalDefaultImageUrl];
          } else {
            variantImages = [finalDefaultImageUrl];
          }

          return {
            id: v.id,
            sku: v.sku?.trim().toUpperCase(),
            price: data.price,
            stock: v.quantity,
            images: variantImages,
            attributes
          };
        });
      } else {
        formattedVariants = [
          {
            sku: generateDefaultSku(data.productCode || 'PROD'),
            price: data.price,
            stock: 1,
            images: [finalDefaultImageUrl],
            attributes: {}
          }
        ];
      }

      const payload = {
        name: data.name.trim(),
        productCode: data.productCode?.trim().toUpperCase() || undefined,
        categoryName: data.categoryName.trim(),
        price: data.price,
        stock: totalStock || 10,
        imageUrl: finalDefaultImageUrl,
        options,
        variants: formattedVariants
      };

      let savedProduct: Product | undefined;
      if (mode === 'create') {
        savedProduct = await createProduct(payload);
        showSuccess('Product created successfully!', 'Success');
      } else {
        if (!initialData?.id) throw new Error('Missing product ID for update');
        savedProduct = await updateProduct(initialData.id, payload);
        showSuccess('Product updated successfully!', 'Success');
      }

      setFormErrorMessages([]);
      if (onSubmitSuccess) {
        onSubmitSuccess(savedProduct);
      } else {
        setTimeout(() => {
          router.push(ROUTES.adminProducts);
        }, 800);
      }
    } catch (err) {
      const rawMsg = (err as Error).message || 'Failed to save product';
      const parsedList = rawMsg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const unhandledErrors: string[] = [];

      parsedList.forEach((msg) => {
        const lower = msg.toLowerCase();
        if (lower.includes('product code') || lower.includes('duplicate_product_code')) {
          setProductCodeConflictError(msg);
          setError('productCode', { type: 'manual', message: msg });
        } else if (lower.includes('sku') || lower.includes('duplicate_sku')) {
          setError('variants', { type: 'manual', message: msg });
        } else if (lower.includes('title') || (lower.includes('name') && !lower.includes('category'))) {
          setError('name', { type: 'manual', message: msg });
        } else if (lower.includes('category')) {
          setError('categoryName', { type: 'manual', message: msg });
          setCustomCategoryError(msg);
        } else if (lower.includes('price')) {
          setError('price', { type: 'manual', message: msg });
        } else if (lower.includes('image')) {
          setError('defaultImageUrl', { type: 'manual', message: msg });
        } else if (lower.includes('quantity') || lower.includes('stock')) {
          setTotalStockError(msg);
          setError('variants', { type: 'manual', message: msg });
        } else {
          unhandledErrors.push(msg);
        }
      });

      setFormErrorMessages(unhandledErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 pt-2">
      {/* Prominent Error Banner */}
      {formErrorMessages.length > 0 && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-bold text-sm text-red-800">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>Product Save Error:</span>
          </div>
          <ul className="list-disc list-inside text-xs font-medium space-y-1 pl-1 text-red-700">
            {formErrorMessages.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row items-stretch gap-6 lg:gap-8">
          {/* Left Column: Required Default Product Image */}
          <div className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col">
            <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Default Product Image <span className="text-red-500">*</span>
            </Label>
            <div className="flex-1 flex flex-col">
              <Controller
                name="defaultImageUrl"
                control={control}
                render={({ field }) => (
                  <DefaultImageUpload
                    file={watch('defaultImageFile')}
                    previewUrl={field.value}
                    onChange={(newFile, newPreviewUrl) => {
                      setValue('defaultImageFile', newFile);
                      field.onChange(newPreviewUrl || '');
                    }}
                    disabled={submitting}
                  />
                )}
              />
            </div>
            {errors.defaultImageUrl && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">
                {errors.defaultImageUrl.message}
              </p>
            )}
          </div>

          {/* Right Column: Title, Product Code, Price, Total Quantity, Category */}
          <div className="flex-1 w-full space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FormField
                  label="Product Title"
                  placeholder="Enter product title..."
                  required
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>
              <div>
                <FormField
                  label="Product Code"
                  placeholder="e.g. GRIP-001"
                  error={errors.productCode?.message || productCodeConflictError || undefined}
                  disabled={mode === 'edit'}
                  {...register('productCode', {
                    onChange: (e) => {
                      setIsManualProductCode(true);
                      const newCode = e.target.value.toUpperCase();
                      e.target.value = newCode;
                      setValue('productCode', newCode, { shouldValidate: true });
                      updateAllVariantSkusWithNewProductCode(newCode);

                      if (!newCode.trim()) {
                        setProductCodeConflictError('Product code is required');
                        return;
                      }

                      fetch(
                        `/api/products/code-check?code=${encodeURIComponent(newCode)}${initialData?.id ? `&excludeId=${initialData.id}` : ''}`
                      )
                        .then((r) => r.json())
                        .then((data) => {
                          if (data.success && data.data && !data.data.available) {
                            setProductCodeConflictError(
                              `Product code '${newCode}' is already in use by another product.`
                            );
                          } else {
                            setProductCodeConflictError(null);
                          }
                        })
                        .catch(() => { });
                    }
                  })}
                  className={cn(
                    'uppercase font-mono',
                    mode === 'edit' && 'bg-slate-100/80 cursor-not-allowed text-slate-700 font-semibold'
                  )}
                />
                {mode === 'edit' && (
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Product code is permanently assigned to preserve barcoding and order history.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormField
                  label="Price ($)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="00.00"
                  required
                  error={errors.price?.message}
                  {...register('price', {
                    valueAsNumber: true,
                    onChange: (e) => {
                      if (parseFloat(e.target.value) < 0) {
                        e.target.value = '0';
                      }
                    }
                  })}
                />
              </div>

              <div className="mb-5">
                <Label htmlFor="totalStock">Quantity (Total Stock)</Label>
                <Input
                  id="totalStock"
                  type="number"
                  readOnly
                  value={totalStock}
                  aria-invalid={!!(totalStockError || (errors.variants?.message && totalStock <= 0))}
                  className={cn(
                    'bg-slate-100/80 cursor-not-allowed font-medium text-slate-700',
                    (totalStockError || (errors.variants?.message && totalStock <= 0)) && 'border-danger focus-visible:ring-danger'
                  )}
                  title="Total stock is calculated automatically as the sum of all variant quantities"
                />
                {totalStockError || (errors.variants?.message && totalStock <= 0) ? (
                  <p role="alert" className="mt-1.5 text-xs text-danger font-medium">
                    {totalStockError || errors.variants?.message}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Auto-calculated from variants</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Product Category */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="categoryName" className="text-sm font-semibold text-slate-700">
                    Product Category
                  </Label>
                </div>

                <div className="relative">
                  <Controller
                    name="categoryName"
                    control={control}
                    render={({ field }) =>
                      isCustomCategory ? (
                        <div className="space-y-1.5">
                          <Input
                            id="categoryName"
                            autoFocus
                            placeholder="Enter category name"
                            value={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              validateCustomCategory(e.target.value);
                            }}
                            className={cn(
                              'h-11 bg-white border-slate-200 focus:border-[#007BFF]',
                              customCategoryError ? 'border-red-500 focus:border-red-500' : ''
                            )}
                          />
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={handleSwitchToDropdownMode}
                              className="text-xs text-[#007BFF] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span> Back to Categories</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <Select
                          id="categoryName"
                          value={field.value}
                          onChange={(e) => {
                            if (e.target.value === '__ADD_NEW__') {
                              handleSwitchToAddMode();
                            } else {
                              field.onChange(e.target.value);
                              setSavedDropdownCategory(e.target.value);
                            }
                          }}
                          error={!!errors.categoryName}
                          className="h-11 bg-white border-slate-200"
                        >
                          <option value="">Select...</option>
                          {dbCategories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                          <option value="__ADD_NEW__">+ Create New Category...</option>
                        </Select>
                      )
                    }
                  />
                </div>
                {customCategoryError ? (
                  <p role="alert" className="mt-1 text-xs text-red-500 font-medium pl-0.5">
                    {customCategoryError}
                  </p>
                ) : errors.categoryName ? (
                  <p role="alert" className="mt-1 text-xs text-red-500 font-medium pl-0.5">
                    {errors.categoryName.message}
                  </p>
                ) : null}
              </div>

              {/* Product Status */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="productStatus" className="text-sm font-semibold text-slate-700">
                    Product Status
                  </Label>
                </div>

                <Select
                  id="productStatus"
                  value={isActive ? 'Active' : 'Inactive'}
                  onChange={(e) => handleStatusSelectChange(e.target.value)}
                  disabled={togglingStatus}
                  className={cn(
                    'h-11 font-semibold bg-white border-slate-200 cursor-pointer',
                    isActive ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'
                  )}
                >
                  <option value="Active">Active</option>
                  {mode === 'edit' && <option value="Inactive">Inactive</option>}
                </Select>
                {statusChangeError && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{statusChangeError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Variants Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-800">Product Variants</h2>
          <p className="text-xs text-slate-500">
            Add variants with Color, Size, Quantity, custom SKU, and optional image. Uploading an image for a color syncs across all variants of that color.
          </p>
        </div>

        {/* Global Variant Validation Errors */}
        {errors.variants?.message && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 font-medium border border-red-200">
            {errors.variants.message}
          </div>
        )}

        {draftError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 font-medium border border-red-200">
            {draftError}
          </div>
        )}

        {/* Quick Add Variant Header Row */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1.3fr_44px_44px] gap-3 items-center bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div>
            <Select
              value={draftColor}
              onChange={(e) => setDraftColor(e.target.value)}
              className="bg-white h-11"
            >
              <option value="">Select Color</option>
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Select
              value={draftSize}
              onChange={(e) => setDraftSize(e.target.value)}
              className="bg-white h-11"
            >
              <option value="">Select Size</option>
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Input
              ref={draftQtyInputRef}
              type="number"
              min="0"
              placeholder="Qty"
              value={draftQty}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== '' && parseInt(val, 10) < 0) {
                  setDraftQty('0');
                } else {
                  setDraftQty(val);
                }
              }}
              className="bg-white h-11"
            />
          </div>

          <div>
            <Input
              placeholder="Variant SKU"
              value={draftSku}
              onChange={(e) => {
                setIsManualSku(true);
                setDraftSku(e.target.value.toUpperCase());
              }}
              className="bg-white h-11 uppercase font-mono text-xs"
              title="Auto-generated default SKU. You can override it manually."
            />
          </div>

          {/* Variant Image Upload for Draft Row (Color-Synced) */}
          <div className="flex justify-center shrink-0">
            <VariantImageUpload
              file={colorImages[draftColor]?.file}
              previewUrl={colorImages[draftColor]?.previewUrl}
              onChange={(newFile, newPreviewUrl) => {
                if (draftColor) {
                  handleColorImageChange(draftColor, newFile, newPreviewUrl);
                } else {
                  setDraftError('Please select a Color first to attach an image');
                }
              }}
              disabled={submitting || !draftColor}
            />
          </div>

          <div className="flex justify-end shrink-0">
            <button
              type="button"
              onClick={handleAddDraftVariant}
              title="Add variant"
              className="bg-[#007BFF] hover:bg-blue-600 text-white h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-5 w-5 stroke-[2.25]" />
            </button>
          </div>
        </div>

        {/* Added Variants List */}
        {fields.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
            No variants added yet. Select Color, Size, Quantity, SKU, and optional image above, then click &quot;+&quot;.
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const colorError = errors.variants?.[index]?.color?.message;
              const sizeError = errors.variants?.[index]?.size?.message;
              const qtyError = errors.variants?.[index]?.quantity?.message;
              const skuError = errors.variants?.[index]?.sku?.message;

              const vColor = (watch(`variants.${index}.color`) || '').trim();
              const variantId = (watch(`variants.${index}`) as { id?: string })?.id;
              const isExistingVariant = mode === 'edit' && Boolean(variantId);

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1.3fr_44px_44px] gap-3 items-center p-3.5 rounded-xl bg-slate-50/50 border border-slate-200"
                >
                  {/* Color Select */}
                  <div>
                    <Controller
                      name={`variants.${index}.color`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Select
                          {...selectField}
                          disabled={isExistingVariant}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            selectField.onChange(newColor);
                            const currentSize = watch(`variants.${index}.size`);
                            const currentProdCode = watch('productCode') || (watch('name') ? generateProductCode(watch('name'), watch('categoryName')) : 'PROD-001');
                            const autoSku = generateDefaultSku(currentProdCode, newColor, currentSize);
                            setValue(`variants.${index}.sku`, autoSku, { shouldValidate: true });
                          }}
                          error={!!colorError}
                          className={cn(
                            'bg-white h-11',
                            isExistingVariant && 'bg-slate-100/80 cursor-not-allowed text-slate-700 font-medium'
                          )}
                        >
                          <option value="">Select Color</option>
                          {COLOR_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      )}
                    />
                    {colorError && (
                      <p className="mt-1 text-xs text-danger font-medium">{colorError}</p>
                    )}
                  </div>

                  {/* Size Select */}
                  <div>
                    <Controller
                      name={`variants.${index}.size`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Select
                          {...selectField}
                          disabled={isExistingVariant}
                          onChange={(e) => {
                            const newSize = e.target.value;
                            selectField.onChange(newSize);
                            const currentColor = watch(`variants.${index}.color`);
                            const currentProdCode = watch('productCode') || (watch('name') ? generateProductCode(watch('name'), watch('categoryName')) : 'PROD-001');
                            const autoSku = generateDefaultSku(currentProdCode, currentColor, newSize);
                            setValue(`variants.${index}.sku`, autoSku, { shouldValidate: true });
                          }}
                          error={!!sizeError}
                          className={cn(
                            'bg-white h-11',
                            isExistingVariant && 'bg-slate-100/80 cursor-not-allowed text-slate-700 font-medium'
                          )}
                        >
                          <option value="">Select Size</option>
                          {SIZE_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      )}
                    />
                    {sizeError && (
                      <p className="mt-1 text-xs text-danger font-medium">{sizeError}</p>
                    )}
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      aria-invalid={!!qtyError}
                      className="bg-white h-11"
                      {...register(`variants.${index}.quantity`, {
                        valueAsNumber: true,
                        onChange: (e) => {
                          if (parseInt(e.target.value, 10) < 0) {
                            e.target.value = '0';
                          }
                        }
                      })}
                    />
                    {qtyError && (
                      <p className="mt-1 text-xs text-danger font-medium">{qtyError}</p>
                    )}
                  </div>

                  {/* SKU Input */}
                  <div>
                    <Input
                      placeholder="SKU"
                      disabled={isExistingVariant}
                      aria-invalid={!!skuError}
                      className={cn(
                        'bg-white h-11 uppercase font-mono text-xs',
                        isExistingVariant && 'bg-slate-100/80 cursor-not-allowed text-slate-700 font-semibold',
                        skuError ? 'border-red-500 focus:border-red-500' : ''
                      )}
                      {...register(`variants.${index}.sku`, {
                        onChange: (e) => {
                          e.target.value = e.target.value.toUpperCase();
                        }
                      })}
                    />
                    {skuError && (
                      <p className="mt-1 text-xs text-danger font-medium">{skuError}</p>
                    )}
                  </div>

                  {/* Image Upload Box directly in variant row (Color-Synced) */}
                  <div className="flex justify-center shrink-0">
                    <VariantImageUpload
                      file={colorImages[vColor]?.file}
                      previewUrl={colorImages[vColor]?.previewUrl}
                      onChange={(newFile, newPreviewUrl) => {
                        if (vColor) {
                          handleColorImageChange(vColor, newFile, newPreviewUrl);
                        } else {
                          setDraftError('Please select a Color first to attach an image');
                        }
                      }}
                      disabled={submitting || !vColor}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(index)}
                      className={cn(
                        'h-11 w-11 p-0 border rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95',
                        fields.length <= 1
                          ? 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                          : 'border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700'
                      )}
                      title={fields.length <= 1 ? 'Cannot remove the only variant' : 'Remove variant'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Submit Action */}
      <div className="flex justify-end pt-3">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold px-10 py-3 text-base rounded-xl shadow-sm h-12"
        >
          {submitting
            ? mode === 'create'
              ? 'Saving Product...'
              : 'Updating Product...'
            : mode === 'create'
              ? 'Save Product'
              : 'Update'}
        </Button>
      </div>

      {/* Status Change Confirmation Modal */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full  space-y-4 border border-slate-200/90 ring-1 ring-slate-900/10">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                  pendingStatusChange === 'deactivate' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                )}
              >
                <AlertCircle className="h-5 w-5 stroke-[2.25]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {pendingStatusChange === 'deactivate' ? 'Deactivate Product?' : 'Restore Product?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pendingStatusChange === 'deactivate'
                    ? 'Deactivating this product will hide it from customer search and shop listings.'
                    : 'Restoring this product will make it active and visible to customers again.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingStatusChange(null)}
                disabled={togglingStatus}
                className="text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmStatusChange}
                disabled={togglingStatus}
                className={cn(
                  'text-xs font-semibold text-white rounded-xl shadow-xs',
                  pendingStatusChange === 'deactivate'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                {togglingStatus
                  ? 'Updating...'
                  : pendingStatusChange === 'deactivate'
                    ? 'Yes, Deactivate'
                    : 'Yes, Restore'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
