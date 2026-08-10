import type { OrderDetail, OrderListItem } from "@/types/order.types";

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

export async function getOrders(
  page = 1,
  limit = 10,
  search?: string
): Promise<{
  orders: OrderListItem[];
  totalCount: number;
  pageSize: number;
}> {
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : "";
  const response = await fetch(
    `/api/orders?page=${page}&limit=${limit}${searchQuery}`,
    {
      cache: "no-store",
    }
  );
  return parseApiResponse<{
    orders: OrderListItem[];
    totalCount: number;
    pageSize: number;
  }>(response);
}

export async function getOrderById(orderId: string): Promise<OrderDetail> {
  const response = await fetch(`/api/orders/${orderId}`, {
    cache: "no-store",
  });
  const data = await parseApiResponse<{ order: OrderDetail }>(response);
  return data.order;
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<void> {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await parseApiResponse(response);
}
