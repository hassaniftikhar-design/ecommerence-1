import type { Product } from "@/types/product.types";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const json: ApiResponse<T> = await response.json();
  if (!response.ok || !json.success) {
    const errorMsg =
      json.errors && json.errors.length > 0
        ? json.errors.join(", ")
        : json.message || "Request failed";
    throw new Error(errorMsg);
  }
  return json.data as T;
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await parseApiResponse<{ url: string }>(response);
  return data.url;
}

export async function getProducts(): Promise<Product[]> {
  if (typeof window === "undefined") {
    const { prisma } = await import("@/lib/prisma");
    const products = await prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        options: {
          include: { values: true },
        },
        variants: {
          include: {
            variantOptions: {
              include: {
                optionValue: {
                  include: {
                    option: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return products.map((product) => {
      const variantsFormatted = product.variants.map((v) => {
        const attributes: Record<string, string> = {};
        const variantOptionsInfo = v.variantOptions.map((vo) => {
          const optionName = vo.optionValue.option.name;
          const value = vo.optionValue.value;
          attributes[optionName] = value;
          return { optionName, value };
        });

        return {
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          price: Number(v.price),
          stock: v.stock,
          images: v.images,
          attributes,
          variantOptions: variantOptionsInfo,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        };
      });

      const prices = variantsFormatted.map((v) => v.price);
      const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
      const primaryImage =
        variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        createdBy: product.createdBy,
        options: product.options.map((opt) => ({
          id: opt.id,
          productId: opt.productId,
          name: opt.name,
          values: opt.values.map((val) => ({
            id: val.id,
            optionId: val.optionId,
            value: val.value,
          })),
        })),
        variants: variantsFormatted,
        price: lowestPrice,
        stock: totalStock,
        imageUrl: primaryImage,
        lowestPrice,
        totalStock,
        variantCount: variantsFormatted.length,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    });
  }

  const response = await fetch("/api/products", {
    cache: "no-store",
  });
  const data = await parseApiResponse<{ products: Product[] }>(response);
  return data.products;
}

export async function getProductById(id: string): Promise<Product> {
  if (typeof window === "undefined") {
    const { prisma } = await import("@/lib/prisma");
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        options: {
          include: { values: true },
        },
        variants: {
          include: {
            variantOptions: {
              include: {
                optionValue: {
                  include: {
                    option: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const variantsFormatted = product.variants.map((v) => {
      const attributes: Record<string, string> = {};
      const variantOptionsInfo = v.variantOptions.map((vo) => {
        const optionName = vo.optionValue.option.name;
        const value = vo.optionValue.value;
        attributes[optionName] = value;
        return { optionName, value };
      });

      return {
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        price: Number(v.price),
        stock: v.stock,
        images: v.images,
        attributes,
        variantOptions: variantOptionsInfo,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });

    const prices = variantsFormatted.map((v) => v.price);
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
    const primaryImage =
      variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      createdBy: product.createdBy,
      options: product.options.map((opt) => ({
        id: opt.id,
        productId: opt.productId,
        name: opt.name,
        values: opt.values.map((val) => ({
          id: val.id,
          optionId: val.optionId,
          value: val.value,
        })),
      })),
      variants: variantsFormatted,
      price: lowestPrice,
      stock: totalStock,
      imageUrl: primaryImage,
      lowestPrice,
      totalStock,
      variantCount: variantsFormatted.length,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  const response = await fetch(`/api/products/${id}`, {
    cache: "no-store",
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export interface CreateProductOptionInput {
  name: string;
  values: string[];
}

export interface CreateProductVariantInput {
  id?: string;
  sku?: string;
  price: number;
  stock: number;
  images?: string[];
  attributes?: Record<string, string>;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  options?: CreateProductOptionInput[];
  variants?: CreateProductVariantInput[];
  // Single variant fallback fields
  price?: number;
  stock?: number;
  imageUrl?: string;
}

export async function createProduct(payload: CreateProductInput): Promise<Product> {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export async function updateProduct(
  id: string,
  payload: Partial<CreateProductInput>
): Promise<Product> {
  const response = await fetch(`/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`/api/products/${id}`, {
    method: "DELETE",
  });
  await parseApiResponse<undefined>(response);
}
