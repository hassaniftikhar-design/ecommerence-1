import type { Product } from "@/types/product.types";
import { DEFAULT_PRODUCT_IMAGE } from "@/constants/generalconstants";
import type { ApiResponse } from "@/lib/api-response";

async function parseApiResponse<T>(response: Response): Promise<T> {
  let json: ApiResponse<T> | null = null;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Server error (${response.status}). Please try again.`);
    }
  }

  if (!response.ok || (json && json.success === false)) {
    let errorMsg = "";

    if (json?.message) {
      errorMsg = json.message;
    } else if (json?.errors && Array.isArray(json.errors) && json.errors.length > 0) {
      errorMsg = json.errors
        .map((err) =>
          typeof err === "string"
            ? err
            : (err as { message?: string })?.message || JSON.stringify(err)
        )
        .filter(Boolean)
        .join(", ");
    }

    if (!errorMsg) {
      errorMsg = `Request failed (${response.status || "Error"}). Please try again.`;
    }

    throw new Error(errorMsg);
  }

  return (json?.data ?? json) as T;
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

export interface GetProductsParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  sort?: string;
  status?: string;
}

export interface PaginatedProductsResponse {
  products: Product[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export async function getProducts(
  paramsOrQuery?: GetProductsParams | string,
  categoryArg?: string,
  sortArg?: string,
  statusArg?: string
): Promise<PaginatedProductsResponse> {
  let page = 1;
  let limit = 12;
  let q = "";
  let category = "";
  let sort = "";
  let status = "";

  if (typeof paramsOrQuery === "object" && paramsOrQuery !== null) {
    page = paramsOrQuery.page || 1;
    limit = paramsOrQuery.limit || 12;
    q = paramsOrQuery.q || "";
    category = paramsOrQuery.category || "";
    sort = paramsOrQuery.sort || "";
    status = paramsOrQuery.status || "";
  } else {
    q = paramsOrQuery || "";
    category = categoryArg || "";
    sort = sortArg || "";
    status = statusArg || "";
  }

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
      whereClause.OR = [
        { name: { contains: q.trim(), mode: "insensitive" } },
        { category: { name: { contains: q.trim(), mode: "insensitive" } } },
      ];
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

    const total = await prisma.product.count({ where: whereClause });
    const skip = (page - 1) * limit;

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
      skip,
      take: limit,
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
        variantsFormatted.find((v) => v.images && v.images.length > 0)?.images[0] ||
        DEFAULT_PRODUCT_IMAGE;

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

    if (sort === "price-asc") {
      formatted.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      formatted.sort((a, b) => b.price - a.price);
    }

    const hasMore = page * limit < total;

    return {
      products: formatted,
      page,
      limit,
      total,
      hasMore,
    };
  }

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (q) queryParams.set("q", q);
  if (category) queryParams.set("category", category);
  if (sort) queryParams.set("sort", sort);
  if (status) queryParams.set("status", status);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const response = await fetch(`/api/products${queryString}`, {
    cache: "no-store",
  });
  const data = await parseApiResponse<{
    products: Product[];
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    pagination?: ProductsPaginationMeta;
  }>(response);

  const total = data.total ?? data.pagination?.totalItems ?? data.products.length;
  const pageNum = data.page ?? data.pagination?.page ?? page;
  const limitNum = data.limit ?? data.pagination?.limit ?? limit;
  const hasMore = data.hasMore ?? (pageNum * limitNum < total);

  return {
    products: data.products || [],
    page: pageNum,
    limit: limitNum,
    total,
    hasMore,
  };
}

export interface ProductsPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface GetProductsPaginatedResult {
  products: Product[];
  pagination: ProductsPaginationMeta;
}

export async function getProductsPaginated(params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  status?: string;
}): Promise<GetProductsPaginatedResult> {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.set("page", String(params.page));
  if (params.limit !== undefined) queryParams.set("limit", String(params.limit));
  if (params.search) queryParams.set("search", params.search);
  if (params.category) queryParams.set("category", params.category);
  if (params.sort) queryParams.set("sort", params.sort);
  if (params.status) queryParams.set("status", params.status);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const response = await fetch(`/api/products${queryString}`, {
    cache: "no-store",
  });
  const data = await parseApiResponse<{
    products: Product[];
    pagination: ProductsPaginationMeta;
  }>(response);

  return {
    products: data.products || [],
    pagination: data.pagination || {
      page: params.page || 1,
      limit: params.limit || 10,
      totalItems: data.products?.length || 0,
      totalPages: Math.ceil((data.products?.length || 0) / (params.limit || 10)) || 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

export interface AdminDashboardStats {
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  validOrdersCount: number;
  activeProducts: number;
  ordersByStatus: {
    IN_PROGRESS: number;
    DISPATCHED: number;
    DELIVERED: number;
    REJECTED: number;
  };
}


let categoriesCache: { id: string; name: string }[] | null = null;
let categoriesPromise: Promise<{ id: string; name: string }[]> | null = null;

export function clearCategoriesCache() {
  categoriesCache = null;
}

export async function getCategories(): Promise<{ id: string; name: string }[]> {
  if (typeof window === "undefined") {
    const { prisma } = await import("@/lib/prisma");
    return prisma.category.findMany({
      orderBy: { name: "asc" },
    });
  }

  if (categoriesCache) {
    return categoriesCache;
  }

  if (categoriesPromise) {
    return categoriesPromise;
  }

  categoriesPromise = (async () => {
    try {
      const response = await fetch("/api/categories", {
        cache: "no-store",
      });
      if (!response.ok) {
        return [];
      }
      const data = await parseApiResponse<{ categories: { id: string; name: string }[] }>(response);
      categoriesCache = data.categories;
      return data.categories;
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      return [];
    } finally {
      categoriesPromise = null;
    }
  })();

  return categoriesPromise;
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
      variantsFormatted.find((v) => v.images && v.images.length > 0)?.images[0] ||
      DEFAULT_PRODUCT_IMAGE;

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
  clearCategoriesCache();
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
  clearCategoriesCache();
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
