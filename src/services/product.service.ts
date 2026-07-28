import type { Product } from "@/types/product.types";

// TODO(backend-integration): once Prisma + PostgreSQL are wired up,
// this becomes a real fetch (likely a Server Component calling this
// directly, since it can be async) against a "products" table. Its
// return type is intentionally the same as the mock data in
// constants/mock-products.ts so the swap is a one-line change on the
// Home page.

export async function getProducts(): Promise<Product[]> {
  throw new Error("Not implemented");
}

export async function addToCart(
  _productId: string,
  _quantity: number,
): Promise<void> {
  throw new Error("Not implemented");
}
