"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, AlertCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/forms/form-field";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/constants/routes";
import { DefaultImageUpload } from "@/components/ui/default-image-upload";
import { VariantImageUpload } from "@/components/ui/variant-image-upload";
import { uploadImage, createProduct, updateProduct, getCategories } from "@/services/product.service";
import { productFormSchema, type ProductFormSchemaValues } from "@/lib/validators";
import type { ProductFormProps } from "@/types/product.types";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Gray",
  "Navy",
  "Brown",
  "Pink",
  "Purple",
  "Orange",
  "Beige",
];

const SIZE_OPTIONS = [
  "Small",
  "Medium",
  "Large",
  "XL",
  "XXL",
  "3XL",
  "XS",
];

export function ProductForm({ mode, initialData, onSubmitSuccess }: ProductFormProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formErrorMessages, setFormErrorMessages] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string }[]>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await getCategories();
        setDbCategories(cats);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    }
    loadCategories();
  }, []);

  // Quick variant addition state
  const [draftColor, setDraftColor] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftQty, setDraftQty] = useState("");
  const [draftFile, setDraftFile] = useState<File | undefined>(undefined);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | undefined>(undefined);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftQtyInputRef = React.useRef<HTMLInputElement>(null);

  // Compute default values from initialData if mode === "edit"
  const getDefaultValues = (): ProductFormSchemaValues => {
    if (mode === "edit" && initialData) {
      const primaryUrl = initialData.imageUrl || initialData.variants?.[0]?.images?.[0] || "";

      const formattedVariants =
        initialData.variants && initialData.variants.length > 0
          ? initialData.variants.map((v) => {
              const color =
                v.attributes?.Color ||
                v.attributes?.color ||
                v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === "color")
                  ?.value ||
                "Black";
              const size =
                v.attributes?.Size ||
                v.attributes?.size ||
                v.variantOptions?.find((vo) => vo.optionName.toLowerCase() === "size")
                  ?.value ||
                "Medium";
              const variantImg = v.images && v.images.length > 0 ? v.images[0] : undefined;
              return {
                id: v.id,
                color,
                size,
                quantity: v.stock,
                previewUrl: variantImg !== primaryUrl ? variantImg : undefined,
              };
            })
          : [
              {
                color: "Black",
                size: "Medium",
                quantity: initialData.stock || 10,
              },
            ];

      return {
        name: initialData.name || "",
        categoryName: initialData.category?.name || "General",
        price: initialData.lowestPrice ?? initialData.price ?? 0,
        defaultImageUrl: primaryUrl,
        variants: formattedVariants,
      };
    }

    return {
      name: "",
      categoryName: "General",
      price: 0,
      defaultImageUrl: "",
      variants: [],
    };
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormSchemaValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const [savedDropdownCategory, setSavedDropdownCategory] = useState<string>(
    mode === "edit" && initialData?.category?.name ? initialData.category.name : "General"
  );
  const [customCategoryError, setCustomCategoryError] = useState<string | null>(null);

  const validateCustomCategory = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setCustomCategoryError("Category name is required.");
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
    const currentVal = watch("categoryName");
    if (currentVal && !isCustomCategory) {
      setSavedDropdownCategory(currentVal);
    }
    setIsCustomCategory(true);
    setValue("categoryName", "");
    setCustomCategoryError(null);
  };

  const handleSwitchToDropdownMode = () => {
    setIsCustomCategory(false);
    setValue("categoryName", savedDropdownCategory || "General");
    setCustomCategoryError(null);
  };

  // Calculate Total Stock automatically as sum of variant quantities
  const watchedVariants = watch("variants") || [];
  const totalStock = watchedVariants.reduce((sum, v) => {
    const qty = Number(v?.quantity);
    return sum + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);

  // Quick Add Variant handler
  const handleAddDraftVariant = () => {
    setDraftError(null);
    let qtyNum = parseInt(draftQty, 10);
    if (isNaN(qtyNum) || qtyNum < 0) {
      qtyNum = 0;
    }

    const colorVal = (draftColor || "").trim();
    const sizeVal = (draftSize || "").trim();

    // Duplicate check for both specific and general variants
    const isDuplicate = watchedVariants.some(
      (v) =>
        (v.color || "").trim().toLowerCase() === colorVal.toLowerCase() &&
        (v.size || "").trim().toLowerCase() === sizeVal.toLowerCase()
    );

    if (isDuplicate) {
      setDraftError(
        !colorVal && !sizeVal
          ? "General variant already exists"
          : "Variant with specified color and size already exists"
      );
      return;
    }

    append({
      color: colorVal,
      size: sizeVal,
      quantity: qtyNum,
      file: draftFile,
      previewUrl: draftPreviewUrl,
    });

    // Reset draft fields
    setDraftColor("");
    setDraftSize("");
    setDraftQty("");
    setDraftFile(undefined);
    setDraftPreviewUrl(undefined);

    setTimeout(() => {
      draftQtyInputRef.current?.focus();
    }, 50);
  };

  const onSubmit = async (data: ProductFormSchemaValues) => {
    try {
      setSubmitting(true);
      if (data.price < 0) {
        showError("Price cannot be negative", "Error");
        return;
      }

      // 1. Upload mandatory Default Product Image if a new file was selected
      let finalDefaultImageUrl = data.defaultImageUrl || "";
      if (data.defaultImageFile) {
        finalDefaultImageUrl = await uploadImage(data.defaultImageFile);
      }

      if (!finalDefaultImageUrl) {
        showError("Default Product Image is required", "Error");
        setSubmitting(false);
        return;
      }

      // 2. Upload optional variant-specific images or fallback to finalDefaultImageUrl
      let formattedVariants = [];
      const options = [];

      if (data.variants && data.variants.length > 0) {
        const uniqueColors = Array.from(
          new Set(data.variants.map((v) => (v.color || "").trim()).filter(Boolean))
        );
        const uniqueSizes = Array.from(
          new Set(data.variants.map((v) => (v.size || "").trim()).filter(Boolean))
        );

        if (uniqueColors.length > 0) options.push({ name: "Color", values: uniqueColors });
        if (uniqueSizes.length > 0) options.push({ name: "Size", values: uniqueSizes });

        formattedVariants = await Promise.all(
          data.variants.map(async (v) => {
            const attributes: Record<string, string> = {};
            if (v.color?.trim()) attributes.Color = v.color.trim();
            if (v.size?.trim()) attributes.Size = v.size.trim();

            let variantImageUrl = finalDefaultImageUrl;
            if (v.file) {
              variantImageUrl = await uploadImage(v.file);
            } else if (v.previewUrl) {
              variantImageUrl = v.previewUrl;
            }

            return {
              id: v.id,
              price: data.price,
              stock: v.quantity,
              images: [variantImageUrl],
              attributes,
            };
          })
        );
      } else {
        formattedVariants = [
          {
            price: data.price,
            stock: 10,
            images: [finalDefaultImageUrl],
            attributes: {},
          },
        ];
      }

      const payload = {
        name: data.name.trim(),
        categoryName: data.categoryName.trim(),
        price: data.price,
        stock: totalStock || 10,
        imageUrl: finalDefaultImageUrl,
        options,
        variants: formattedVariants,
      };

      if (mode === "create") {
        await createProduct(payload);
        showSuccess("Product created successfully!", "Success");
      } else {
        if (!initialData?.id) throw new Error("Missing product ID for update");
        await updateProduct(initialData.id, payload);
        showSuccess("Product updated successfully!", "Success");
      }

      setFormErrorMessages([]);
      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else {
        setTimeout(() => {
          router.push(ROUTES.adminProducts);
        }, 800);
      }
    } catch (err) {
      const rawMsg = (err as Error).message || "Failed to save product";
      const parsedList = rawMsg
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setFormErrorMessages(parsedList.length > 0 ? parsedList : [rawMsg]);
      showError(parsedList[0] || "Failed to save product", "Product Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
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
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Left Column: Required Default Product Image */}
          <div className="w-full md:w-56 shrink-0">
            <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Default Product Image <span className="text-red-500">*</span>
            </Label>
            <Controller
              name="defaultImageUrl"
              control={control}
              render={({ field }) => (
                <DefaultImageUpload
                  file={watch("defaultImageFile")}
                  previewUrl={field.value}
                  onChange={(newFile, newPreviewUrl) => {
                    setValue("defaultImageFile", newFile);
                    field.onChange(newPreviewUrl || "");
                  }}
                  disabled={submitting}
                />
              )}
            />
            {errors.defaultImageUrl && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">
                {errors.defaultImageUrl.message}
              </p>
            )}
          </div>

          {/* Right Column: Title, Price, Total Quantity, Category */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <FormField
                label="Product Title"
                placeholder="Enter product title..."
                error={errors.name?.message}
                {...register("name")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormField
                  label="Price ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="00.00"
                  error={errors.price?.message}
                  {...register("price", {
                    valueAsNumber: true,
                    onChange: (e) => {
                      if (parseFloat(e.target.value) < 0) {
                        e.target.value = "0";
                      }
                    },
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
                  className="bg-slate-100/80 cursor-not-allowed font-medium text-slate-700"
                  title="Total stock is calculated automatically as the sum of all variant quantities"
                />
                <p className="mt-1 text-xs text-slate-500">Auto-calculated from variants</p>
              </div>
            </div>

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
                            "h-11 bg-white border-slate-200 focus:border-[#007BFF]",
                            customCategoryError ? "border-red-500 focus:border-red-500" : ""
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
                          if (e.target.value === "__ADD_NEW__") {
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
          </div>
        </div>
      </div>

      {/* Product Variants Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-800">Product Variants</h2>
          <p className="text-xs text-slate-500">
            Add variants with Color, Size, Quantity, and an optional variant-specific image.
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
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_44px] gap-3 items-center bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
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
              placeholder="Enter Qty"
              value={draftQty}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "" && parseInt(val, 10) < 0) {
                  setDraftQty("0");
                } else {
                  setDraftQty(val);
                }
              }}
              className="bg-white h-11"
            />
          </div>

          <div>
            <VariantImageUpload
              file={draftFile}
              previewUrl={draftPreviewUrl}
              onChange={(file, previewUrl) => {
                setDraftFile(file);
                setDraftPreviewUrl(previewUrl);
              }}
              disabled={submitting}
            />
          </div>

          <div className="flex justify-end">
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
            No variants added yet. Select Color, Size, Quantity, and optional image above, then click &quot;+&quot;.
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const colorError = errors.variants?.[index]?.color?.message;
              const sizeError = errors.variants?.[index]?.size?.message;
              const qtyError = errors.variants?.[index]?.quantity?.message;

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_44px] gap-3 items-center p-3.5 rounded-xl bg-slate-50/50 border border-slate-200"
                >
                  {/* Color Select */}
                  <div>
                    <Controller
                      name={`variants.${index}.color`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Select
                          {...selectField}
                          error={!!colorError}
                          className="bg-white h-11"
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
                          error={!!sizeError}
                          className="bg-white h-11"
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
                            e.target.value = "0";
                          }
                        },
                      })}
                    />
                    {qtyError && (
                      <p className="mt-1 text-xs text-danger font-medium">{qtyError}</p>
                    )}
                  </div>

                  {/* Optional Variant Image Uploader */}
                  <div>
                    <Controller
                      name={`variants.${index}.previewUrl`}
                      control={control}
                      render={({ field: imgField }) => (
                        <VariantImageUpload
                          file={watch(`variants.${index}.file`)}
                          previewUrl={imgField.value}
                          onChange={(newFile, newPreviewUrl) => {
                            setValue(`variants.${index}.file`, newFile);
                            imgField.onChange(newPreviewUrl || "");
                          }}
                          disabled={submitting}
                        />
                      )}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="h-11 w-11 p-0 border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95"
                      title="Remove variant"
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
            ? mode === "create"
              ? "Saving Product..."
              : "Updating Product..."
            : mode === "create"
              ? "Save Product"
              : "Update"}
        </Button>
      </div>
    </form>
  );
}
