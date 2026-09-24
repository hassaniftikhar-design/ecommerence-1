import 'server-only';

import { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getProductByIdServer } from '@/server/services/product.service';
import { getCartServer, addToCartServer } from '@/server/services/cart.service';
import { getAdminDashboardStatsServer } from '@/server/services/dashboard.service';

import { getMyOrdersServer, searchMyOrdersServer } from './order-retrieval';
import { searchProductsHybridServer } from './product-retrieval';

export type ChatActor = { userId: string; role: 'USER' | 'ADMIN' };
export type ChatToolName =
  | 'searchProducts' | 'getProduct' | 'getCurrentProductPrice' | 'getCurrentProductStock'
  | 'getMyOrders' | 'getMyOrder' | 'getMyOrderStatus' | 'getMyCart' | 'addToCart'
  | 'getRevenue' | 'getRevenueByDateRange' | 'getTopSellingProducts'
  | 'getLowestSellingProducts' | 'getOrderAnalytics' | 'getInventoryAnalytics';

type ToolInput = Record<string, unknown>;

function stringInput(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`Invalid ${field}`);
  }
  return value.trim();
}

async function requireCurrentActor(actor: ChatActor, adminOnly = false) {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, isActive: true }
  });
  if (!user?.isActive) throw new Error('Your account is unavailable');
  if (adminOnly && user.role !== 'ADMIN') throw new Error('This tool is available to administrators only');
  return user.role;
}

async function getRevenueByDateRange(actor: ChatActor, input: ToolInput) {
  const from = new Date(stringInput(input.from, 'from date', 40));
  const to = new Date(stringInput(input.to, 'to date', 40));
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    throw new Error('Invalid date range');
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error('Date range cannot exceed one year');
  }

  await requireCurrentActor(actor, true);
  const aggregate = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    _count: { _all: true },
    where: { status: { not: OrderStatus.REJECTED }, createdAt: { gte: from, lt: to } }
  });
  return { from: from.toISOString(), to: to.toISOString(), revenue: Number(aggregate._sum.totalAmount || 0), orders: aggregate._count._all };
}

async function getTopSellingProducts(actor: ChatActor, direction: 'desc' | 'asc') {
  await requireCurrentActor(actor, true);
  const sales = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: { order: { status: { not: OrderStatus.REJECTED } } },
    orderBy: { _sum: { quantity: direction } },
    take: 10
  });
  const productIds = sales.map((sale) => sale.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, productCode: true }
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return sales.flatMap((sale) => {
    const product = byId.get(sale.productId);
    return product ? [{ ...product, unitsSold: sale._sum.quantity || 0 }] : [];
  });
}

export async function executeChatbotTool(
  actor: ChatActor,
  tool: ChatToolName,
  input: ToolInput = {},
  options: { userConfirmed?: boolean } = {}
): Promise<unknown> {
  const currentRole = await requireCurrentActor(actor);
  const verifiedActor = { userId: actor.userId, role: currentRole } as ChatActor;

  switch (tool) {
    case 'searchProducts': {
      const query = stringInput(input.query, 'query', 500);
      return searchProductsHybridServer(query);
    }
    case 'getProduct':
    case 'getCurrentProductPrice':
    case 'getCurrentProductStock': {
      const productId = stringInput(input.productId, 'productId', 100);
      const product = await getProductByIdServer(productId, false);
      if (!product) return null;
      if (tool === 'getCurrentProductPrice') return { productId, price: product.price };
      if (tool === 'getCurrentProductStock') {
        return { productId, stock: product.variants.map((variant) => ({ variantId: variant.id, sku: variant.sku, stock: variant.stock, attributes: variant.attributes })) };
      }
      return product;
    }
    case 'getMyOrders':
      return getMyOrdersServer(actor.userId);
    case 'getMyOrder':
    case 'getMyOrderStatus': {
      const orderNumber = stringInput(input.orderNumber, 'orderNumber', 40).replace(/[^\p{L}\p{N}-]/gu, '');
      const orders = await searchMyOrdersServer(actor.userId, orderNumber);
      return tool === 'getMyOrderStatus'
        ? orders.map(({ orderNumber: number, status }) => ({ orderNumber: number, status }))
        : orders;
    }
    case 'getMyCart':
      return getCartServer(actor.userId);
    case 'addToCart': {
      if (!options.userConfirmed) throw new Error('Add to cart requires an explicit customer confirmation');
      const productId = stringInput(input.productId, 'productId', 100);
      const variantId = typeof input.variantId === 'string' ? input.variantId : undefined;
      const quantity = typeof input.quantity === 'number' ? Math.floor(input.quantity) : 1;
      if (variantId) {
        const product = await getProductByIdServer(productId, false);
        if (!product?.variants.some((variant) => variant.id === variantId)) {
          throw new Error('The selected product variant is unavailable');
        }
      }
      return addToCartServer(actor.userId, productId, variantId, quantity);
    }
    case 'getRevenue':
      await requireCurrentActor(verifiedActor, true);
      return getAdminDashboardStatsServer();
    case 'getRevenueByDateRange':
      return getRevenueByDateRange(verifiedActor, input);
    case 'getTopSellingProducts':
      return getTopSellingProducts(verifiedActor, 'desc');
    case 'getLowestSellingProducts': {
      await requireCurrentActor(verifiedActor, true);
      const [products, sales] = await Promise.all([
        prisma.product.findMany({
          where: { isActive: true },
          select: { id: true, name: true, productCode: true }
        }),
        prisma.orderItem.groupBy({
          by: ['productId'],
          _sum: { quantity: true },
          where: { order: { status: { not: OrderStatus.REJECTED } } }
        })
      ]);
      const salesByProductId = new Map(sales.map((sale) => [sale.productId, sale._sum.quantity || 0]));
      return products
        .map((product) => ({ ...product, unitsSold: salesByProductId.get(product.id) || 0 }))
        .sort((a, b) => a.unitsSold - b.unitsSold)
        .slice(0, 10);
    }
    case 'getOrderAnalytics':
      await requireCurrentActor(verifiedActor, true);
      return getAdminDashboardStatsServer();
    case 'getInventoryAnalytics': {
      await requireCurrentActor(verifiedActor, true);
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, variants: { select: { stock: true } } }
      });
      return products.map((product) => ({
        productId: product.id,
        name: product.name,
        stock: product.variants.reduce((total, variant) => total + variant.stock, 0)
      }));
    }
    default: {
      const exhaustive: never = tool;
      throw new Error(`Unsupported chatbot tool: ${String(exhaustive)}`);
    }
  }
}

export function availableChatTools(role: ChatActor['role']): ChatToolName[] {
  const customerTools: ChatToolName[] = [
    'searchProducts', 'getProduct', 'getCurrentProductPrice', 'getCurrentProductStock',
    'getMyOrders', 'getMyOrder', 'getMyOrderStatus', 'getMyCart', 'addToCart'
  ];
  if (role !== 'ADMIN') return customerTools;
  return [
    ...customerTools,
    'getRevenue', 'getRevenueByDateRange', 'getTopSellingProducts',
    'getLowestSellingProducts', 'getOrderAnalytics', 'getInventoryAnalytics'
  ];
}
