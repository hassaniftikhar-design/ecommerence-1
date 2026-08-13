import type { Product } from "@/types/product.types";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

const DEFAULT_PRODUCT_IMAGE = "/placeholder-product.png";

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

export async function getProducts(
  q?: string,
  category?: string,
  sort?: string,
  status?: string
): Promise<Product[]> {
  if (typeof window === "undefined") {
    const { prisma } = await import("@/lib/prisma");

    const whereClause: Record<string, unknown> = {};
    if (status === "active") {
      whereClause.isActive = true;
    } else if (status === "inactive") {
      whereClause.isActive = false;
    } else if (status !== "all") {
      whereClause.isActive = true;
    }

    if (q && q.trim()) {
      whereClause.name = { contains: q.trim(), mode: "insensitive" };
    }
    if (category && category.trim()) {
      whereClause.category = { name: { equals: category.trim(), mode: "insensitive" } };
    }

    let orderByClause: Record<string, unknown> = { createdAt: "desc" };
    if (sort === "name-asc") {
      orderByClause = { name: "asc" };
    } else if (sort === "price-asc") {
      orderByClause = { price: "asc" };
    } else if (sort === "price-desc") {
      orderByClause = { price: "desc" };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
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
      orderBy: orderByClause,
    });

    const formatted = products.map((product) => {
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
          stock: v.stock,
          images: v.images,
          attributes,
          variantOptions: variantOptionsInfo,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        };
      });

      const productPrice = Number(product.price);
      const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
      const primaryImage =
        variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

      return {
        id: product.id,
        name: product.name,
        isActive: product.isActive,
        inactiveAt: product.inactiveAt ? product.inactiveAt.toISOString() : null,
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
        price: productPrice,
        stock: totalStock,
        imageUrl: primaryImage,
        lowestPrice: productPrice,
        totalStock,
        variantCount: variantsFormatted.length,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    });

    return formatted;
  }

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (status) params.set("status", status);

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/products${queryString}`, {
    cache: "no-store",
  });
  const data = await parseApiResponse<{ products: Product[] }>(response);
  return data.products;
}

export async function getCategories(): Promise<{ id: string; name: string }[]> {
  if (typeof window === "undefined") {
    const { prisma } = await import("@/lib/prisma");
    return prisma.category.findMany({
      orderBy: { name: "asc" },
    });
  }

  const response = await fetch("/api/categories", {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const data = await parseApiResponse<{ categories: { id: string; name: string }[] }>(response);
  return data.categories;
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
        stock: v.stock,
        images: v.images,
        attributes,
        variantOptions: variantOptionsInfo,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });

    const productPrice = Number(product.price);
    const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
    const primaryImage =
      variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

    return {
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      inactiveAt: product.inactiveAt ? product.inactiveAt.toISOString() : null,
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
      price: productPrice,
      stock: totalStock,
      imageUrl: primaryImage,
      lowestPrice: productPrice,
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

export async function activateProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/products/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: true }),
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export async function deactivateProduct(id: string): Promise<Product> {
  const response = await fetch(`/api/products/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: false }),
  });
  const data = await parseApiResponse<{ product: Product }>(response);
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  await deactivateProduct(id);
}
