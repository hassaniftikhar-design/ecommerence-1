import { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function getAdminDashboardStatsServer() {
  const totalOrders = await prisma.order.count();
  const totalProducts = await prisma.product.count();
  const activeProducts = await prisma.product.count({
    where: { isActive: true }
  });

  const validOrdersRevenue = await prisma.order.aggregate({
    _sum: {
      totalAmount: true
    },
    where: {
      status: {
        not: OrderStatus.REJECTED
      }
    }
  });

  const totalRevenue = Number(validOrdersRevenue._sum.totalAmount || 0);

  const inProgressCount = await prisma.order.count({ where: { status: OrderStatus.IN_PROGRESS } });
  const dispatchedCount = await prisma.order.count({ where: { status: OrderStatus.DISPATCHED } });
  const deliveredCount = await prisma.order.count({ where: { status: OrderStatus.DELIVERED } });
  const rejectedCount = await prisma.order.count({ where: { status: OrderStatus.REJECTED } });

  const validOrdersCount = totalOrders - rejectedCount;

  return {
    totalOrders,
    totalProducts,
    totalRevenue,
    validOrdersCount,
    activeProducts,
    ordersByStatus: {
      IN_PROGRESS: inProgressCount,
      DISPATCHED: dispatchedCount,
      DELIVERED: deliveredCount,
      REJECTED: rejectedCount
    }
  };
}
