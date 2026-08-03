import type { Product } from "@/types/product.types";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

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
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        imageUrl: true,
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return products.map((product) => ({
      ...product,
      price: Number(product.price),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    }));
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
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        imageUrl: true,
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return {
      ...product,
      price: Number(product.price),
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

export interface CreateProductInput {
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  categoryId?: string;
  categoryName?: string;
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
    method: "PATCH",
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
