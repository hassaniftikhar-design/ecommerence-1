import type { Product } from "@/types/product.types";

// TODO(backend-integration): this static array is a stand-in for
// `product.service.ts -> getProducts()` reading from PostgreSQL via
// Prisma. Kept here (not inline in the page) so swapping the data
// source later means changing one import, not the page markup.
export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Bluetooth Wireless Speaker with Superior Sound Quality",
    price: 0,
    imageUrl: "https://placehold.co/400x400/f8f9fa/212529?text=Speaker+Set",
    quantity: 2,
  },
  {
    id: "2",
    name: "LED Desk Lamp with Adjustable Brightness and Color Temperature",
    price: 0,
    imageUrl: "https://placehold.co/400x400/e9ecef/212529?text=Desk+Lamp",
    quantity: 2,
  },
  {
    id: "3",
    name: "Stylish Leather Backpack for Daily Use - Multiple Colors Available",
    price: 0,
    imageUrl: "https://placehold.co/400x400/f8f9fa/212529?text=Backpack",
    quantity: 2,
  },
  {
    id: "4",
    name: "Wireless Charging Pad for Smartphones and Devices",
    price: 0,
    imageUrl: "https://placehold.co/400x400/e9ecef/212529?text=Charging+Pad",
    quantity: 2,
  },
  {
    id: "5",
    name: "LENOVO Silver Black HE05 NECKBAND HEADPHONE (ORIGINAL)",
    price: 0,
    imageUrl: "https://placehold.co/400x400/f8f9fa/212529?text=Neckband",
    quantity: 2,
  },
  {
    id: "6",
    name: "Wooden Plant Stand 2 Tier Foldable Flower Pot Display Shelf Rack Solid",
    price: 0,
    imageUrl: "https://placehold.co/400x400/e9ecef/212529?text=Plant+Stand",
    quantity: 2,
  },
  {
    id: "7",
    name: "Black Markhor Printed Pure Cotton T-Shirts P Cap and Trouser for Men",
    price: 0,
    imageUrl: "https://placehold.co/400x400/f8f9fa/212529?text=T-Shirt+Set",
    quantity: 2,
  },
  {
    id: "8",
    name: "Cargo Trousers for Men - 6 Pocket Trousers in all Colors",
    price: 0,
    imageUrl: "https://placehold.co/400x400/e9ecef/212529?text=Cargo+Trousers",
    quantity: 2,
  },
];
