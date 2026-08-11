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
        items: {
          include: {
            variant: {
              include: {
                variantOptions: {
                  include: {
                    optionValue: {
                      include: {
                        option: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
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

    const uniqueProductCount = new Set(order.items.map((item) => item.productId)).size;

    const formattedDetail = {
      id: order.id,
      date: formatDate(order.createdAt),
      orderNumber: order.orderNumber,
      user: order.user.name || "Customer",
      productsCount: uniqueProductCount || order.items.length,
      amount: Number(order.totalAmount),
      subTotal: Number(order.subTotal),
      tax: Number(order.tax),
      totalAmount: Number(order.totalAmount),
      status: order.status,
      products: order.items.map((item) => {
        let color: string | undefined = undefined;
        let size: string | undefined = undefined;

        if (item.variant?.variantOptions) {
          for (const vo of item.variant.variantOptions) {
            const optionName = vo.optionValue?.option?.name?.toLowerCase();
            const val = vo.optionValue?.value;
            if (optionName === "color") color = val;
            if (optionName === "size") size = val;
          }
        }

        return {
          id: item.id,
          productId: item.productId,
          title: item.title,
          imageUrl: item.imageUrl,
          price: Number(item.price),
          quantity: item.quantity,
          stock: item.variant?.stock ?? item.stock,
          color,
          size,
        };
      }),
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

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return apiError("Order not found", [], 404);
    }

    const previousStatus = existingOrder.status;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Transitioning to REJECTED (Return items back to stock)
      if (previousStatus !== "REJECTED" && status === "REJECTED") {
        for (const item of existingOrder.items) {
          let targetVariantId = item.variantId;
          if (!targetVariantId) {
            const firstVariant = await tx.productVariant.findFirst({
              where: { productId: item.productId },
            });
            if (firstVariant) {
              targetVariantId = firstVariant.id;
            }
          }

          if (targetVariantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: targetVariantId },
            });
            if (variant) {
              await tx.productVariant.update({
                where: { id: targetVariantId },
                data: { stock: variant.stock + item.quantity },
              });
            }
          }
        }
      }

      // 2. Transitioning from REJECTED back to active status (Deduct items from stock again)
      if (previousStatus === "REJECTED" && status !== "REJECTED") {
        for (const item of existingOrder.items) {
          let targetVariantId = item.variantId;
          if (!targetVariantId) {
            const firstVariant = await tx.productVariant.findFirst({
              where: { productId: item.productId },
            });
            if (firstVariant) {
              targetVariantId = firstVariant.id;
            }
          }

          if (targetVariantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: targetVariantId },
            });
            if (variant) {
              await tx.productVariant.update({
                where: { id: targetVariantId },
                data: { stock: Math.max(0, variant.stock - item.quantity) },
              });
            }
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: { status },
        include: {
          user: { select: { name: true } },
          items: true,
        },
      });
    });

    const statusLabels: Record<OrderStatus, string> = {
      IN_PROGRESS: "processing",
      DISPATCHED: "shipped",
      DELIVERED: "delivered",
      REJECTED: "cancelled",
    };

    const readableStatus = statusLabels[status] || status.toLowerCase();

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: existingOrder.userId,
        title: "Order Status Updated",
        message: `Your order #${existingOrder.orderNumber} is now ${readableStatus}.`,
        type: "ORDER_STATUS_UPDATED",
        orderId: updatedOrder.id,
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
