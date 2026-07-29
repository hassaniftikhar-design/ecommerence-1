import type { Product } from "@/types/product.types";

// TODO(backend-integration): this static array is a stand-in for
// `product.service.ts -> getProducts()` reading from PostgreSQL via
// Prisma. Kept here (not inline in the page) so swapping the data
// source later means changing one import, not the page markup.
export const MOCK_PRODUCTS = [
  {
    id: 1,
    name: "Wireless Speaker",
    price: 149.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    name: "Bluetooth Headphones",
    price: 89.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    name: "Smart Watch",
    price: 249.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 4,
    name: "Mechanical Keyboard",
    price: 129.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 5,
    name: "Wireless Speaker",
    price: 149.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 6,
    name: "Bluetooth Headphones",
    price: 89.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 7,
    name: "Smart Watch",
    price: 249.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 8,
    name: "Mechanical Keyboard",
    price: 129.99,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=600&q=80",
  },
];