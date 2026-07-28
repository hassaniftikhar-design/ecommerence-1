import type { OrderDetail, OrderListItem } from "@/types/order.types";

export async function getOrders(_page: number): Promise<{
  orders: OrderListItem[];
  totalCount: number;
  pageSize: number;
}> {
  throw new Error("Not implemented");
}

export async function getOrderById(
  _orderId: string,
): Promise<OrderDetail | null> {
  throw new Error("Not implemented");
}
