import type { Product } from "@/types/product.types";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Wireless Speaker",
    price: 149.99,
    stock: 10,
    imageUrl:
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80",
    isActive: true,
    category: { id: "cat-1", name: "Audio" },
    createdBy: { id: "admin-1", name: "Admin" },
    options: [],
    variants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Bluetooth Headphones",
    price: 89.99,
    stock: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
    isActive: true,
    category: { id: "cat-1", name: "Audio" },
    createdBy: { id: "admin-1", name: "Admin" },
    options: [],
    variants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Smart Watch",
    price: 249.99,
    stock: 8,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
    isActive: true,
    category: { id: "cat-2", name: "Wearables" },
    createdBy: { id: "admin-1", name: "Admin" },
    options: [],
    variants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Mechanical Keyboard",
    price: 129.99,
    stock: 20,
    imageUrl:
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=600&q=80",
    isActive: true,
    category: { id: "cat-3", name: "Peripherals" },
    createdBy: { id: "admin-1", name: "Admin" },
    options: [],
    variants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];