import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { OrderStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can access dashboard details", [], 403);
    }

    // 1. Total count of all orders
    const totalOrders = await prisma.order.count();

    // 2. Total count of all products
    const totalProducts = await prisma.product.count();
    const activeProducts = await prisma.product.count({
      where: { isActive: true },
    });

    // 3. Sum of totalAmount for all orders EXCEPT REJECTED
    const validOrdersRevenue = await prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: {
          not: OrderStatus.REJECTED,
        },
      },
    });

    const totalRevenue = Number(validOrdersRevenue._sum.totalAmount || 0);

    // 4. Breakdown count per status
    const inProgressCount = await prisma.order.count({ where: { status: OrderStatus.IN_PROGRESS } });
    const dispatchedCount = await prisma.order.count({ where: { status: OrderStatus.DISPATCHED } });
    const deliveredCount = await prisma.order.count({ where: { status: OrderStatus.DELIVERED } });
    const rejectedCount = await prisma.order.count({ where: { status: OrderStatus.REJECTED } });

    const validOrdersCount = totalOrders - rejectedCount;

    return apiSuccess("Dashboard statistics retrieved successfully", {
      totalOrders,
      totalProducts,
      totalRevenue,
      validOrdersCount,
      activeProducts,
      ordersByStatus: {
        IN_PROGRESS: inProgressCount,
        DISPATCHED: dispatchedCount,
        DELIVERED: deliveredCount,
        REJECTED: rejectedCount,
      },
    });
  } catch (error) {
    return apiError("Failed to retrieve dashboard statistics", [(error as Error).message], 500);
  }
}
