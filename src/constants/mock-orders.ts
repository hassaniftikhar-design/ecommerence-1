import type { OrderDetail, OrderListItem } from "@/types/order.types";

// TODO(backend-integration): stand-in for
// order.service.ts#getOrders(page), which will paginate a real
// "orders" table via Prisma.
export const MOCK_ORDERS: OrderListItem[] = Array.from(
  { length: 8 },
  (_, i) => ({
    id: `${342590 + i}`,
    date: "22 March 2023",
    orderNumber: `${342590 + i}`,
    user: "Jackson Smith",
    productsCount: 3,
    amount: 0,
  }),
);

export const MOCK_ORDERS_TOTAL_COUNT = 42;
export const MOCK_ORDERS_PAGE_SIZE = 8;

// TODO(backend-integration): stand-in for
// order.service.ts#getOrderById(id).
export const MOCK_ORDER_DETAIL: OrderDetail = {
  id: "342599",
  date: "23 March 2023",
  orderNumber: "342599",
  user: "Jackson Smith",
  productsCount: 3,
  amount: 0,
  products: Array.from({ length: 7 }, (_, i) => ({
    id: `order-line-${i + 1}`,
    title:
      "Cargo Trousers for Men - 6 Pocket Trousers - 6 Pocket Cargo Trousers in all Colors - Cargo Trouser",
    imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80",
    price: 0,
    quantity: 12,
    stock: 45,
  })),
};
