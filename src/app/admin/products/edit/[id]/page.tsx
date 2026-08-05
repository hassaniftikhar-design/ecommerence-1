"use client";

import { useState, useEffect, useRef, use, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload as UploadIcon,
  Check,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { ROUTES } from "@/constants/routes";
import {
  getProductById,
  updateProduct,
  uploadImage,
} from "@/services/product.service";

interface FormOption {
  name: string;
  valuesInput: string;
}

interface FormVariant {
  id?: string;
  sku?: string;
  price: string;
  stock: string;
  images: string[];
  attributes: Record<string, string>;
}

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [loadingProduct, setLoadingProduct] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [baseStock, setBaseStock] = useState("");
  const [categoryName, setCategoryName] = useState("General");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [variantUploadingIndex, setVariantUploadingIndex] = useState<number | null>(null);

  const [options, setOptions] = useState<FormOption[]>([]);
  const [variants, setVariants] = useState<FormVariant[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingProduct(true);
        const prod = await getProductById(id);
        setName(prod.name);
        setDescription(prod.description || "");
        setCategoryName(prod.category.name);

        const primaryImg =
          prod.imageUrl || prod.variants?.[0]?.images?.[0] || "";
        setMainImageUrl(primaryImg);
        setBasePrice(String(prod.lowestPrice ?? prod.price ?? 0));
        setBaseStock(String(prod.totalStock ?? prod.stock ?? 0));

        if (prod.options && prod.options.length > 0) {
          setOptions(
            prod.options.map((opt) => ({
              name: opt.name,
              valuesInput: opt.values.map((v) => v.value).join(", "),
            }))
          );
        }

        if (prod.variants && prod.variants.length > 0) {
          setVariants(
            prod.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              price: String(v.price),
              stock: String(v.stock),
              images: v.images || [],
              attributes: v.attributes || {},
            }))
          );
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingProduct(false);
      }
    }
    loadData();
  }, [id]);

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const url = await uploadImage(file);
      setMainImageUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleAddOption = () => {
    setOptions((prev) => [...prev, { name: "", valuesInput: "" }]);
  };

  const handleRemoveOption = (index: number) => {
    const optToRemove = options[index];
    setOptions((prev) => prev.filter((_, i) => i !== index));
    if (optToRemove?.name) {
      setVariants((prev) =>
        prev.map((v) => {
          const newAttr = { ...v.attributes };
          delete newAttr[optToRemove.name];
          return { ...v, attributes: newAttr };
        })
      );
    }
  };

  const handleOptionChange = (
    index: number,
    field: "name" | "valuesInput",
    value: string
  ) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
    );
  };

  const handleAddVariant = () => {
    const defaultAttr: Record<string, string> = {};
    options.forEach((opt) => {
      if (opt.name.trim()) {
        const valArray = opt.valuesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (valArray.length > 0 && valArray[0]) {
          defaultAttr[opt.name.trim()] = valArray[0];
        }
      }
    });

    setVariants((prev) => [
      ...prev,
      {
        price: basePrice || "0",
        stock: baseStock || "0",
        images: mainImageUrl ? [mainImageUrl] : [],
        attributes: defaultAttr,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: "price" | "stock",
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleVariantAttributeChange = (
    variantIndex: number,
    optionName: string,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === variantIndex
          ? { ...v, attributes: { ...v.attributes, [optionName]: value } }
          : v
      )
    );
  };

  const handleVariantImageUpload = async (
    variantIndex: number,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setVariantUploadingIndex(variantIndex);
      setError(null);
      const url = await uploadImage(file);
      setVariants((prev) =>
        prev.map((v, i) =>
          i === variantIndex ? { ...v, images: [...v.images, url] } : v
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVariantUploadingIndex(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveVariantImage = (variantIndex: number, imgIndex: number) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === variantIndex
          ? { ...v, images: v.images.filter((_, idx) => idx !== imgIndex) }
          : v
      )
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError("Please enter a valid product name.");
      return;
    }

    const formattedOptions = options
      .map((opt) => ({
        name: opt.name.trim(),
        values: opt.valuesInput
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      }))
      .filter((opt) => opt.name && opt.values.length > 0);

    let formattedVariants: Array<{
      id?: string;
      sku?: string;
      price: number;
      stock: number;
      images: string[];
      attributes: Record<string, string>;
    }> = [];

    if (variants.length > 0) {
      const seenCombos = new Set<string>();

      for (const [i, v] of variants.entries()) {
        const priceNum = parseFloat(v.price);
        const stockNum = parseInt(v.stock, 10);

        if (isNaN(priceNum) || priceNum <= 0) {
          setError(`Variant #${i + 1} has an invalid price.`);
          return;
        }
        if (isNaN(stockNum) || stockNum < 0) {
          setError(`Variant #${i + 1} has an invalid stock quantity.`);
          return;
        }

        const comboKey = Object.entries(v.attributes)
          .sort(([k1], [k2]) => k1.localeCompare(k2))
          .map(([k, val]) => `${k}:${val}`)
          .join("|");

        if (comboKey && seenCombos.has(comboKey)) {
          setError(
            `Duplicate variant combination detected (${Object.entries(v.attributes)
              .map(([k, val]) => `${k}: ${val}`)
              .join(", ")}). Each variant combination must be unique.`
          );
          return;
        }
        if (comboKey) seenCombos.add(comboKey);

        formattedVariants.push({
          id: v.id,
          sku: v.sku,
          price: priceNum,
          stock: stockNum,
          images: v.images.length > 0 ? v.images : mainImageUrl ? [mainImageUrl] : [],
          attributes: v.attributes,
        });
      }
    }

    try {
      setSubmitting(true);
      await updateProduct(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        categoryName: categoryName.trim() || "General",
        options: formattedOptions,
        variants: formattedVariants.length > 0 ? formattedVariants : undefined,
        price: basePrice ? parseFloat(basePrice) : undefined,
        stock: baseStock ? parseInt(baseStock, 10) : undefined,
        imageUrl: mainImageUrl.trim() || undefined,
      });

      setSuccessMsg("Product updated successfully!");
      setTimeout(() => {
        router.push(ROUTES.adminProducts);
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="py-12 text-center text-slate-600 font-medium">
        Access Denied. Only ADMIN users can access this page.
      </div>
    );
  }

  if (loadingProduct) {
    return (
      <div className="py-12 text-center text-slate-500 font-medium">
        Loading product details...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-12">
      {/* Heading with Arrow */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.adminProducts}
          className="text-[#0B192C] hover:text-[#007BFF] transition"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-[#0B192C]">Edit Product</h1>
      </div>

      <hr className="border-slate-200" />

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 font-medium border border-red-200">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-600 font-medium flex items-center gap-2 border border-emerald-200">
          <Check className="h-4 w-4" /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 pt-2">
        {/* Basic Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-3">
            1. Basic Information
          </h2>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-full md:w-56 shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50 min-h-[220px]">
              {mainImageUrl ? (
                <div className="space-y-3 w-full text-center">
                  <img
                    src={mainImageUrl}
                    alt="Product preview"
                    className="h-28 w-28 mx-auto rounded-lg object-cover border border-slate-200"
                  />
                  <p className="text-xs text-emerald-600 font-semibold truncate max-w-full">
                    Main Image Uploaded
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTriggerFileInput}
                    disabled={uploading}
                    className="w-full text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Change Image
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 flex flex-col items-center w-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#007BFF]">
                    <UploadIcon className="h-6 w-6" />
                  </div>
                  <Button
                    type="button"
                    onClick={handleTriggerFileInput}
                    disabled={uploading}
                    className="w-full bg-[#007BFF] hover:bg-blue-600 text-white font-medium px-6 py-2 text-sm shadow-sm"
                  >
                    {uploading ? "Uploading..." : "Upload Main Image"}
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex-1 w-full space-y-4">
              <FormField
                label="Product Name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Base Price ($)"
                  name="basePrice"
                  type="number"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
                <FormField
                  label="Base Stock"
                  name="baseStock"
                  type="number"
                  value={baseStock}
                  onChange={(e) => setBaseStock(e.target.value)}
                />
              </div>

              <div>
                <FormField
                  label="Category Name"
                  name="categoryName"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Options Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                2. Product Options (Attributes)
              </h2>
              <p className="text-xs text-slate-500">
                Define dynamic option types like Color, Size, Storage, Material, etc.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleAddOption}
              className="border-[#007BFF] text-[#007BFF] hover:bg-blue-50 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Add Option
            </Button>
          </div>

          {options.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No product options defined yet. Click "+ Add Option" to add attributes like Color or Size.
            </div>
          ) : (
            <div className="space-y-4">
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-slate-50/70 border border-slate-200"
                >
                  <div className="w-full sm:w-1/3">
                    <FormField
                      label={`Option Name #${i + 1}`}
                      name={`opt_name_${i}`}
                      value={opt.name}
                      onChange={(e) => handleOptionChange(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:flex-1">
                    <FormField
                      label="Values (comma separated)"
                      name={`opt_values_${i}`}
                      value={opt.valuesInput}
                      onChange={(e) => handleOptionChange(i, "valuesInput", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(i)}
                    className="text-red-500 hover:text-red-700 p-2 sm:mt-2 self-end sm:self-center"
                    title="Remove Option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variants Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                3. Product Variants
              </h2>
              <p className="text-xs text-slate-500">
                Manage variant prices, stock, images, and attributes.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleAddVariant}
              className="bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Add Variant
            </Button>
          </div>

          {variants.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No variants defined. Click "+ Add Variant" to create variants.
            </div>
          ) : (
            <div className="space-y-6">
              {variants.map((variant, vIdx) => (
                <div
                  key={vIdx}
                  className="p-5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-700">
                        Variant #{vIdx + 1}
                      </span>
                      {variant.sku && (
                        <span className="text-xs font-mono text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                          SKU: {variant.sku}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(vIdx)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Variant
                    </button>
                  </div>

                  {options.filter((o) => o.name.trim()).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-white p-3 rounded-lg border border-slate-200">
                      {options
                        .filter((o) => o.name.trim())
                        .map((opt, oIdx) => {
                          const valList = opt.valuesInput
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const optName = opt.name.trim();

                          return (
                            <div key={oIdx} className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600">
                                {optName}
                              </label>
                              <select
                                className="w-full h-10 px-3 rounded border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                value={variant.attributes[optName] || valList[0] || ""}
                                onChange={(e) =>
                                  handleVariantAttributeChange(
                                    vIdx,
                                    optName,
                                    e.target.value
                                  )
                                }
                              >
                                {valList.map((val, valIdx) => (
                                  <option key={valIdx} value={val}>
                                    {val}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Variant Price ($)"
                      name={`v_price_${vIdx}`}
                      type="number"
                      step="0.01"
                      value={variant.price}
                      onChange={(e) =>
                        handleVariantChange(vIdx, "price", e.target.value)
                      }
                      required
                    />
                    <FormField
                      label="Variant Stock"
                      name={`v_stock_${vIdx}`}
                      type="number"
                      value={variant.stock}
                      onChange={(e) =>
                        handleVariantChange(vIdx, "stock", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Variant Images
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      {variant.images.map((imgUrl, imgIdx) => (
                        <div
                          key={imgIdx}
                          className="relative group h-16 w-16 rounded-lg overflow-hidden border border-slate-200"
                        >
                          <img
                            src={imgUrl}
                            alt="Variant preview"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantImage(vIdx, imgIdx)}
                            className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          variantFileInputRefs.current[vIdx]?.click()
                        }
                        disabled={variantUploadingIndex === vIdx}
                        className="h-16 px-4 text-xs border-dashed border-slate-300 text-slate-600 hover:bg-white"
                      >
                        {variantUploadingIndex === vIdx
                          ? "Uploading..."
                          : "+ Add Image"}
                      </Button>
                      <input
                        ref={(el) => {
                          variantFileInputRefs.current[vIdx] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleVariantImageUpload(vIdx, e)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={submitting || uploading}
            className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold px-10 py-3 text-base rounded-xl shadow-sm"
          >
            {submitting ? "Updating Product..." : "Update Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
