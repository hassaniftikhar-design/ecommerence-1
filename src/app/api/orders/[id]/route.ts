import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { OrderStatus } from "@prisma/client";

function formatDate(dateObj: Date): string {
  return dateObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(request);

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    if (!order) {
      return apiError("Order not found", [], 404);
    }

    // Access check: User must own the order or be ADMIN
    const userId = user?.id || user?.sub;
    if (user?.role !== "ADMIN" && order.userId !== userId) {
      return apiError("Forbidden: Cannot access this order", [], 403);
    }

    const formattedDetail = {
      id: order.id,
      date: formatDate(order.createdAt),
      orderNumber: order.orderNumber,
      user: order.user.name || "Customer",
      productsCount: order.items.length,
      amount: Number(order.totalAmount),
      subTotal: Number(order.subTotal),
      tax: Number(order.tax),
      totalAmount: Number(order.totalAmount),
      status: order.status,
      products: order.items.map((item) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        price: Number(item.price),
        quantity: item.quantity,
        stock: item.stock,
      })),
    };

    return apiSuccess("Order retrieved successfully", { order: formattedDetail });
  } catch (error) {
    return apiError("Failed to fetch order", [(error as Error).message], 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can update order status", [], 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: OrderStatus };

    const validStatuses: OrderStatus[] = [
      "IN_PROGRESS",
      "DISPATCHED",
      "DELIVERED",
      "REJECTED",
    ];

    if (!validStatuses.includes(status)) {
      return apiError("Invalid status value", [], 400);
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { name: true } },
        items: true,
      },
    });

    return apiSuccess("Order status updated successfully", {
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    return apiError("Failed to update order status", [(error as Error).message], 500);
  }
}
