"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, FolderPlus, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/forms/form-field";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/constants/routes";
import { createProduct, updateProduct, getCategories } from "@/services/product.service";
import { productFormSchema, type ProductFormSchemaValues } from "@/lib/validators";
import type { ProductFormProps } from "@/types/product.types";

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

  // Quick variant addition state (matching header controls in design screenshot)
  const [draftColor, setDraftColor] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftQty, setDraftQty] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  // Compute default values from initialData if mode === "edit"
  const getDefaultValues = (): ProductFormSchemaValues => {
    if (mode === "edit" && initialData) {
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
              return {
                id: v.id,
                color,
                size,
                quantity: v.stock,
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
        imageUrl: initialData.imageUrl || initialData.variants?.[0]?.images?.[0] || "",
        variants: formattedVariants,
      };
    }

    return {
      name: "",
      categoryName: "General",
      price: 0,
      imageUrl: "",
      variants: [],
    };
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProductFormSchemaValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  // Calculate Total Stock automatically as sum of variant quantities
  const watchedVariants = watch("variants") || [];
  const totalStock = watchedVariants.reduce((sum, v) => {
    const qty = Number(v?.quantity);
    return sum + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);

  // Quick Add Variant handler
  const handleAddDraftVariant = () => {
    setDraftError(null);
    const qtyNum = parseInt(draftQty, 10);
    if (isNaN(qtyNum) || qtyNum < 0) {
      setDraftError("Quantity cannot be negative");
      return;
    }

    const colorVal = (draftColor || "").trim();
    const sizeVal = (draftSize || "").trim();

    // Duplicate check if both color and size are specified
    if (colorVal || sizeVal) {
      const isDuplicate = watchedVariants.some(
        (v) =>
          (v.color || "").trim().toLowerCase() === colorVal.toLowerCase() &&
          (v.size || "").trim().toLowerCase() === sizeVal.toLowerCase()
      );

      if (isDuplicate) {
        setDraftError(`Variant with specified color and size already exists`);
        return;
      }
    }

    append({
      color: colorVal,
      size: sizeVal,
      quantity: qtyNum,
    });

    // Reset draft fields
    setDraftColor("");
    setDraftSize("");
    setDraftQty("");
  };

  const onSubmit = async (data: ProductFormSchemaValues) => {
    try {
      setSubmitting(true);
      if (data.price < 0) {
        showError("Price cannot be negative", "Error");
        return;
      }

      let formattedVariants = [];
      const options = [];

      if (data.variants && data.variants.length > 0) {
        // Extract unique colors and sizes for Product Options schema
        const uniqueColors = Array.from(
          new Set(data.variants.map((v) => (v.color || "").trim()).filter(Boolean))
        );
        const uniqueSizes = Array.from(
          new Set(data.variants.map((v) => (v.size || "").trim()).filter(Boolean))
        );

        if (uniqueColors.length > 0) options.push({ name: "Color", values: uniqueColors });
        if (uniqueSizes.length > 0) options.push({ name: "Size", values: uniqueSizes });

        formattedVariants = data.variants.map((v) => {
          const attributes: Record<string, string> = {};
          if (v.color?.trim()) attributes.Color = v.color.trim();
          if (v.size?.trim()) attributes.Size = v.size.trim();

          return {
            id: v.id,
            price: data.price,
            stock: v.quantity,
            images: data.imageUrl ? [data.imageUrl] : [],
            attributes,
          };
        });
      } else {
        // Fallback single default variant when no custom options added
        formattedVariants = [
          {
            price: data.price,
            stock: 10,
            images: data.imageUrl ? [data.imageUrl] : [],
            attributes: {},
          },
        ];
      }

      const payload = {
        name: data.name.trim(),
        categoryName: data.categoryName.trim(),
        price: data.price,
        stock: totalStock || 10,
        imageUrl: data.imageUrl || undefined,
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

      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else {
        setTimeout(() => {
          router.push(ROUTES.adminProducts);
        }, 800);
      }
    } catch (err) {
      const msg = (err as Error).message || "Failed to save product";
      showError(msg, "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
      {/* Main Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Left Column: Reusable Image Upload */}
          <div className="w-full md:w-56 shrink-0">
            <Controller
              name="imageUrl"
              control={control}
              render={({ field }) => (
                <ImageUpload
                  value={field.value ? [field.value] : []}
                  onChange={(urls) => field.onChange(urls[0] || "")}
                  disabled={submitting}
                  maxFiles={1}
                />
              )}
            />
            {errors.imageUrl && (
              <p className="mt-1 text-xs text-danger font-medium">
                {errors.imageUrl.message}
              </p>
            )}
          </div>

          {/* Right Column: Name (Title), Price, Quantity (Total Stock), Category */}
          <div className="flex-1 w-full space-y-4">
            {/* Product Title */}
            <div>
              <FormField
                label="Product Title"
                placeholder="Enter product title..."
                error={errors.name?.message}
                {...register("name")}
              />
            </div>

            {/* Price & Quantity (Read-only total stock) */}
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

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="categoryName" className="text-sm font-medium">
                  Category
                </Label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory((prev) => !prev)}
                  className="text-xs text-[#007BFF] hover:underline font-semibold flex items-center gap-1"
                >
                  {isCustomCategory ? (
                    <>
                      <List className="h-3.5 w-3.5" /> Select Existing Category
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-3.5 w-3.5" /> + Add New Category
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <Controller
                  name="categoryName"
                  control={control}
                  render={({ field }) =>
                    isCustomCategory ? (
                      <Input
                        id="categoryName"
                        placeholder="Type new category name..."
                        value={field.value}
                        onChange={field.onChange}
                        className="bg-white"
                      />
                    ) : (
                      <Select
                        id="categoryName"
                        value={field.value}
                        onChange={(e) => {
                          if (e.target.value === "__ADD_NEW__") {
                            setIsCustomCategory(true);
                            field.onChange("");
                          } else {
                            field.onChange(e.target.value);
                          }
                        }}
                        error={!!errors.categoryName}
                      >
                        <option value="">Select Category</option>
                        {dbCategories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                        <option value="__ADD_NEW__">+ Add New Category...</option>
                      </Select>
                    )
                  }
                />
              </div>
              {errors.categoryName && (
                <p role="alert" className="mt-1.5 text-sm text-danger font-medium">
                  {errors.categoryName.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Variants Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-800">Product Variants</h2>
          <p className="text-xs text-slate-500">
            Add variants with Color, Size, and Quantity. At least one variant is required.
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

        {/* Top Header Row for Adding New Variant */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center bg-slate-50/80 p-3.5 rounded-lg border border-slate-200">
          <div>
            <Select
              value={draftColor}
              onChange={(e) => setDraftColor(e.target.value)}
              className="bg-white"
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
              className="bg-white"
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
              type="number"
              placeholder="Enter Qty"
              value={draftQty}
              onChange={(e) => setDraftQty(e.target.value)}
              className="bg-white"
            />
          </div>

          <div className="flex justify-end sm:justify-start">
            <Button
              type="button"
              onClick={handleAddDraftVariant}
              className="bg-[#007BFF] hover:bg-blue-600 text-white h-11 px-4 text-sm font-semibold rounded-lg flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        {/* Added Variants List */}
        {fields.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
            No variants added yet. Select a Color, Size, and Quantity above and click &quot;+ Add&quot;.
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
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 rounded-lg bg-slate-50/50 border border-slate-200"
                >
                  {/* Color Select */}
                  <div className="w-full sm:w-1/3">
                    <Controller
                      name={`variants.${index}.color`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Select
                          {...selectField}
                          error={!!colorError}
                          className="bg-white"
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
                  <div className="w-full sm:w-1/3">
                    <Controller
                      name={`variants.${index}.size`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Select
                          {...selectField}
                          error={!!sizeError}
                          className="bg-white"
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
                  <div className="w-full sm:w-1/4">
                    <Input
                      type="number"
                      placeholder="Qty"
                      aria-invalid={!!qtyError}
                      className="bg-white"
                      {...register(`variants.${index}.quantity`, {
                        valueAsNumber: true,
                      })}
                    />
                    {qtyError && (
                      <p className="mt-1 text-xs text-danger font-medium">{qtyError}</p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <div className="self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => remove(index)}
                      className="h-11 w-11 p-0 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center justify-center shrink-0"
                      title="Remove variant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
