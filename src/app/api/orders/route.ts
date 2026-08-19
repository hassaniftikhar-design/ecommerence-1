import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  listOrdersServer,
  createOrderServer,
} from "@/server/services/order.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const query = searchParams.get("query") || searchParams.get("search") || searchParams.get("q") || "";

    const result = await listOrdersServer({
      userId,
      userRole: user?.role,
      page,
      limit,
      query,
    });

    return apiSuccess("Orders retrieved successfully", result);
  } catch (error) {
    return apiError("Failed to fetch orders", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiError("Unauthorized to place order", [], 401);
    }

    let body: { itemIds?: string[]; expectedTotal?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Optional body
    }

    const result = await createOrderServer(userId, body.itemIds, body.expectedTotal);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status, result.data);
    }

    return apiSuccess(
      "Order placed successfully",
      { orderId: result.orderId, orderNumber: result.orderNumber },
      result.status
    );
  } catch (error) {
    return apiError("Failed to place order", [(error as Error).message], 500);
  }
}
