import 'server-only';

import { OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getProductByIdServer } from '@/server/services/product.service';
import { getCartServer, addToCartServer } from '@/server/services/cart.service';

import { getMyOrdersServer, searchMyOrdersServer } from './order-retrieval';
import { searchProductsHybridServer } from './product-retrieval';
import { parseDateFilter } from './date-parser';

export type ChatActor = { userId: string; role: 'USER' | 'ADMIN' | 'GUEST' };
export type ChatToolName =
  | 'searchProducts' | 'getProduct' | 'getCurrentProductPrice' | 'getCurrentProductStock'
  | 'getMyOrders' | 'getMyOrder' | 'getMyOrderStatus' | 'getMyCart' | 'addToCart'
  | 'getRevenue' | 'getRevenueByDateRange' | 'getTopSellingProducts'
  | 'getLowestSellingProducts' | 'getOrderAnalytics' | 'getInventoryAnalytics'
  | 'checkProductStock' | 'searchAdminOrders' | 'searchCustomers' | 'getAdminNotifications';

type ToolInput = Record<string, unknown>;

function stringInput(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`Invalid ${field}`);
  }
  return value.trim();
}

async function requireCurrentActor(actor: ChatActor, adminOnly = false) {
  if (actor.role === 'GUEST') {
    if (adminOnly) throw new Error('This tool is available to administrators only');
    throw new Error('Please login first as this action requires you to login first');
  }
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, isActive: true }
  });
  if (!user?.isActive) throw new Error('Your account is unavailable');
  if (adminOnly && user.role !== 'ADMIN') throw new Error('This tool is available to administrators only');
  return user.role;
}

async function getRevenueWithPeriod(actor: ChatActor, input: ToolInput) {
  await requireCurrentActor(actor, true);

  const parsed = parseDateFilter({
    period: typeof input.period === 'string' ? input.period : undefined,
    from: typeof input.from === 'string' ? input.from : undefined,
    to: typeof input.to === 'string' ? input.to : undefined,
    days: typeof input.days === 'number' ? input.days : undefined,
    date: typeof input.date === 'string' ? input.date : undefined,
    query: typeof input.query === 'string' ? input.query : undefined
  });

  if (parsed.isInvalid || parsed.isFuture) {
    return {
      period: parsed.periodLabel,
      totalOrders: 0,
      totalProducts: 0,
      totalRevenue: 0,
      validOrdersCount: 0,
      activeProducts: 0,
      averageOrderValue: 0,
      ordersByStatus: { IN_PROGRESS: 0, DISPATCHED: 0, DELIVERED: 0, REJECTED: 0 },
      message: parsed.errorMessage
    };
  }

  const dateFilter = parsed.dateFilter;
  const periodLabel = parsed.periodLabel;

  const [totalOrders, totalProducts, activeProducts, validOrdersRevenue, statusCounts] = await Promise.all([
    prisma.order.count({ where: dateFilter ? { createdAt: dateFilter } : {} }),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { not: OrderStatus.REJECTED },
        ...(dateFilter ? { createdAt: dateFilter } : {})
      }
    }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: dateFilter ? { createdAt: dateFilter } : {}
    })
  ]);

  const ordersByStatus = {
    IN_PROGRESS: 0,
    DISPATCHED: 0,
    DELIVERED: 0,
    REJECTED: 0
  };
  for (const sc of statusCounts) {
    if (sc.status in ordersByStatus) {
      ordersByStatus[sc.status as keyof typeof ordersByStatus] = sc._count._all;
    }
  }

  const totalRevenue = Number(validOrdersRevenue._sum.totalAmount || 0);
  const validOrdersCount = totalOrders - ordersByStatus.REJECTED;
  const averageOrderValue = validOrdersCount > 0 ? totalRevenue / validOrdersCount : 0;

  return {
    period: periodLabel,
    totalOrders,
    totalProducts,
    totalRevenue,
    validOrdersCount,
    activeProducts,
    averageOrderValue,
    ordersByStatus
  };
}

async function getOrderAnalytics(actor: ChatActor, input: ToolInput) {
  await requireCurrentActor(actor, true);

  const parsed = parseDateFilter({
    period: typeof input.period === 'string' ? input.period : undefined,
    from: typeof input.from === 'string' ? input.from : undefined,
    to: typeof input.to === 'string' ? input.to : undefined,
    days: typeof input.days === 'number' ? input.days : undefined,
    date: typeof input.date === 'string' ? input.date : undefined,
    query: typeof input.query === 'string' ? input.query : undefined
  });

  if (parsed.isInvalid || parsed.isFuture) {
    return {
      period: parsed.periodLabel,
      totalOrders: 0,
      inProgress: 0,
      dispatched: 0,
      delivered: 0,
      rejected: 0,
      message: parsed.errorMessage
    };
  }

  const dateFilter = parsed.dateFilter;
  const periodLabel = parsed.periodLabel;

  const [totalOrders, statusCounts] = await Promise.all([
    prisma.order.count({ where: dateFilter ? { createdAt: dateFilter } : {} }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: dateFilter ? { createdAt: dateFilter } : {}
    })
  ]);

  const counts: Record<OrderStatus, number> = {
    [OrderStatus.IN_PROGRESS]: 0,
    [OrderStatus.DISPATCHED]: 0,
    [OrderStatus.DELIVERED]: 0,
    [OrderStatus.REJECTED]: 0
  };

  for (const sc of statusCounts) {
    if (sc.status in counts) {
      counts[sc.status as OrderStatus] = sc._count._all;
    }
  }

  return {
    period: periodLabel,
    totalOrders,
    inProgress: counts[OrderStatus.IN_PROGRESS],
    dispatched: counts[OrderStatus.DISPATCHED],
    delivered: counts[OrderStatus.DELIVERED],
    rejected: counts[OrderStatus.REJECTED]
  };
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

async function getTopSellingProducts(actor: ChatActor, direction: 'desc' | 'asc', limit = 5) {
  await requireCurrentActor(actor, true);
  const sales = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: { order: { status: { not: OrderStatus.REJECTED } } },
    orderBy: { _sum: { quantity: direction } },
    take: limit
  });
  const productIds = sales.map((sale) => sale.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, productCode: true, price: true }
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return sales.flatMap((sale) => {
    const product = byId.get(sale.productId);
    return product ? [{ ...product, price: Number(product.price), unitsSold: sale._sum.quantity || 0 }] : [];
  });
}

async function checkProductStock(actor: ChatActor, input: ToolInput) {
  await requireCurrentActor(actor, true);
  const query = typeof input.query === 'string' && input.query.trim() ? input.query.trim() : '';
  const colorHint = typeof input.color === 'string' && input.color.trim() ? input.color.trim().toLowerCase() : undefined;
  const sizeHint = typeof input.size === 'string' && input.size.trim() ? input.size.trim().toLowerCase() : undefined;
  const skuHint = typeof input.sku === 'string' && input.sku.trim() ? input.sku.trim().toLowerCase() : undefined;

  let targetProduct = null;
  if (skuHint) {
    const variantRow = await prisma.productVariant.findFirst({
      where: { sku: { equals: skuHint, mode: 'insensitive' } },
      select: { productId: true }
    });
    if (variantRow) {
      targetProduct = await getProductByIdServer(variantRow.productId, false);
    }
  }

  if (!targetProduct && query) {
    const skuMatch = query.match(/\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/);
    if (skuMatch) {
      const variantRow = await prisma.productVariant.findFirst({
        where: { sku: { equals: skuMatch[0], mode: 'insensitive' } },
        select: { productId: true }
      });
      if (variantRow) {
        targetProduct = await getProductByIdServer(variantRow.productId, false);
      }
    }
  }

  if (!targetProduct && query) {
    const retrieval = await searchProductsHybridServer(query);
    if (retrieval.products.length > 0 && retrieval.products[0]) {
      targetProduct = await getProductByIdServer(retrieval.products[0].product.id, false);
    }
  }

  if (!targetProduct) {
    return { found: false, query, message: `No product matching "${query || skuHint || 'query'}" was found in the store catalog.` };
  }

  const variants = targetProduct.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    stock: v.stock,
    attributes: v.attributes || {}
  }));

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  let requestedVariant: typeof variants[0] | null = null;
  if (skuHint) {
    requestedVariant = variants.find((v) => v.sku.toLowerCase() === skuHint) || null;
  }
  if (!requestedVariant && (colorHint || sizeHint)) {
    requestedVariant = variants.find((v) => {
      const attrs = Object.values(v.attributes).map((val) => String(val).toLowerCase());
      const hasColor = !colorHint || attrs.some((a) => a.includes(colorHint) || colorHint.includes(a));
      const hasSize = !sizeHint || attrs.some((a) => a.includes(sizeHint) || sizeHint.includes(a));
      return hasColor && hasSize;
    }) || null;
  }

  return {
    found: true,
    product: {
      id: targetProduct.id,
      name: targetProduct.name,
      productCode: targetProduct.productCode,
      price: targetProduct.price,
      imageUrl: targetProduct.imageUrl,
      category: targetProduct.category.name,
      isActive: targetProduct.isActive,
      totalStock,
      variantsCount: variants.length,
      requestedVariant: requestedVariant ? {
        id: requestedVariant.id,
        sku: requestedVariant.sku,
        stock: requestedVariant.stock,
        attributes: requestedVariant.attributes
      } : null,
      variants
    }
  };
}

async function searchAdminOrders(actor: ChatActor, input: ToolInput) {
  await requireCurrentActor(actor, true);
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const orderNumber = typeof input.orderNumber === 'string' ? input.orderNumber.trim() : '';
  const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  const rawStatus = typeof input.status === 'string' ? input.status.trim().toUpperCase() : undefined;
  const validStatusList = Object.values(OrderStatus) as string[];
  const status = rawStatus && validStatusList.includes(rawStatus) ? (rawStatus as OrderStatus) : undefined;
  const limit = typeof input.limit === 'number' ? Math.min(50, Math.max(1, input.limit)) : 10;

  const parsed = parseDateFilter({
    period: typeof input.period === 'string' ? input.period : undefined,
    from: typeof input.from === 'string' ? input.from : undefined,
    to: typeof input.to === 'string' ? input.to : undefined,
    days: typeof input.days === 'number' ? input.days : undefined,
    date: typeof input.date === 'string' ? input.date : undefined,
    query: typeof input.query === 'string' ? input.query : undefined
  });

  if (parsed.isInvalid || parsed.isFuture) {
    return [];
  }

  const dateFilter = parsed.dateFilter;

  const searchTerms = [query, orderNumber, customerName].filter(Boolean);

  const whereClause: Record<string, unknown> = {
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(status ? { status } : {}),
    ...(searchTerms.length > 0 ? {
      OR: searchTerms.flatMap((term) => [
        { orderNumber: { contains: term, mode: 'insensitive' as const } },
        { user: { name: { contains: term, mode: 'insensitive' as const } } },
        { user: { email: { contains: term, mode: 'insensitive' as const } } },
        { items: { some: { title: { contains: term, mode: 'insensitive' as const } } } }
      ])
    } : {})
  };

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        select: {
          title: true,
          quantity: true,
          price: true,
          variant: {
            select: {
              sku: true,
              variantOptions: {
                select: {
                  optionValue: {
                    select: { value: true, option: { select: { name: true } } }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt,
    customerName: o.user.name || 'Customer',
    customerEmail: o.user.email,
    items: o.items.map((it) => {
      const attrs: Record<string, string> = {};
      if (it.variant?.variantOptions) {
        for (const vo of it.variant.variantOptions) {
          attrs[vo.optionValue.option.name] = vo.optionValue.value;
        }
      }
      return {
        title: it.title,
        quantity: it.quantity,
        price: Number(it.price),
        sku: it.variant?.sku || null,
        attributes: Object.keys(attrs).length ? attrs : null
      };
    })
  }));
}

async function searchCustomers(actor: ChatActor, input: ToolInput) {
  await requireCurrentActor(actor, true);
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const limit = typeof input.limit === 'number' ? Math.min(20, Math.max(1, input.limit)) : 5;

  const users = await prisma.user.findMany({
    where: {
      role: 'USER',
      ...(query ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query, mode: 'insensitive' as const } }
        ]
      } : {})
    },
    include: {
      orders: {
        where: { status: { not: OrderStatus.REJECTED } },
        select: { id: true, orderNumber: true, totalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return users.map((u) => {
    const totalSpent = u.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const lastOrder = u.orders[0];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      joinedAt: u.createdAt,
      ordersCount: u.orders.length,
      totalSpent,
      lastOrder: lastOrder ? {
        id: lastOrder.id,
        orderNumber: lastOrder.orderNumber,
        status: lastOrder.status,
        totalAmount: Number(lastOrder.totalAmount),
        createdAt: lastOrder.createdAt
      } : null
    };
  });
}

async function getAdminNotifications(actor: ChatActor, input: ToolInput) {
  await requireCurrentActor(actor, true);
  const unreadOnly = Boolean(input.unreadOnly);
  const limit = typeof input.limit === 'number' ? Math.min(20, Math.max(1, input.limit)) : 5;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: actor.userId,
      ...(unreadOnly ? { isRead: false } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: n.isRead,
    createdAt: n.createdAt
  }));
}

export async function executeChatbotTool(
  actor: ChatActor,
  tool: ChatToolName,
  input: ToolInput = {},
  options: { userConfirmed?: boolean } = {}
): Promise<unknown> {
  const isPublicTool = tool === 'searchProducts' || tool === 'getProduct' || tool === 'getCurrentProductPrice' || tool === 'getCurrentProductStock';
  const isAdminTool = tool.startsWith('getRevenue') || tool.startsWith('getTopSelling') || tool.startsWith('getLowestSelling') || tool.startsWith('getOrderAnalytics') || tool.startsWith('getInventoryAnalytics') || tool === 'checkProductStock' || tool === 'searchAdminOrders' || tool === 'searchCustomers' || tool === 'getAdminNotifications';

  let verifiedActor: ChatActor;
  if (isPublicTool && actor.role === 'GUEST') {
    verifiedActor = actor;
  } else {
    const currentRole = await requireCurrentActor(actor, isAdminTool);
    verifiedActor = { userId: actor.userId, role: currentRole } as ChatActor;
  }

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
      return getRevenueWithPeriod(verifiedActor, input);
    case 'getRevenueByDateRange':
      return getRevenueByDateRange(verifiedActor, input);
    case 'getTopSellingProducts':
      return getTopSellingProducts(verifiedActor, 'desc', typeof input.limit === 'number' ? input.limit : 5);
    case 'getLowestSellingProducts': {
      await requireCurrentActor(verifiedActor, true);
      const [products, sales] = await Promise.all([
        prisma.product.findMany({
          where: { isActive: true },
          select: { id: true, name: true, productCode: true, price: true }
        }),
        prisma.orderItem.groupBy({
          by: ['productId'],
          _sum: { quantity: true },
          where: { order: { status: { not: OrderStatus.REJECTED } } }
        })
      ]);
      const salesByProductId = new Map(sales.map((sale) => [sale.productId, sale._sum.quantity || 0]));
      return products
        .map((product) => ({ ...product, price: Number(product.price), unitsSold: salesByProductId.get(product.id) || 0 }))
        .sort((a, b) => a.unitsSold - b.unitsSold)
        .slice(0, typeof input.limit === 'number' ? input.limit : 5);
    }
    case 'getOrderAnalytics':
      await requireCurrentActor(verifiedActor, true);
      return getOrderAnalytics(verifiedActor, input);
    case 'getInventoryAnalytics': {
      await requireCurrentActor(verifiedActor, true);
      const filter = typeof input.filter === 'string' ? input.filter : 'all';
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, productCode: true, variants: { select: { stock: true } } }
      });
      const items = products.map((product) => ({
        productId: product.id,
        name: product.name,
        productCode: product.productCode,
        stock: product.variants.reduce((total, variant) => total + variant.stock, 0)
      }));
      if (filter === 'low_stock') return items.filter((p) => p.stock > 0 && p.stock <= 5);
      if (filter === 'out_of_stock') return items.filter((p) => p.stock === 0);
      return items;
    }
    case 'checkProductStock':
      return checkProductStock(verifiedActor, input);
    case 'searchAdminOrders':
      return searchAdminOrders(verifiedActor, input);
    case 'searchCustomers':
      return searchCustomers(verifiedActor, input);
    case 'getAdminNotifications':
      return getAdminNotifications(verifiedActor, input);
    default: {
      const exhaustive: never = tool;
      throw new Error(`Unsupported chatbot tool: ${String(exhaustive)}`);
    }
  }
}

export function availableChatTools(role: ChatActor['role']): ChatToolName[] {
  const publicTools: ChatToolName[] = [
    'searchProducts', 'getProduct', 'getCurrentProductPrice', 'getCurrentProductStock'
  ];
  if (role === 'GUEST') return publicTools;
  const customerTools: ChatToolName[] = [
    ...publicTools,
    'getMyOrders', 'getMyOrder', 'getMyOrderStatus', 'getMyCart', 'addToCart'
  ];
  if (role !== 'ADMIN') return customerTools;
  return [
    ...customerTools,
    'getRevenue', 'getRevenueByDateRange', 'getTopSellingProducts',
    'getLowestSellingProducts', 'getOrderAnalytics', 'getInventoryAnalytics',
    'checkProductStock', 'searchAdminOrders', 'searchCustomers', 'getAdminNotifications'
  ];
}

