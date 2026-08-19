import type { OrderDetail, OrderListItem } from "@/types/order.types";
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

export async function getOrders(
  page = 1,
  limit = 10,
  search?: string
): Promise<{
  orders: OrderListItem[];
  totalCount: number;
  totalUnits: number;
  totalAmount: number;
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
    totalUnits: number;
    totalAmount: number;
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
