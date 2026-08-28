import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { TAX_RATE, DEFAULT_PRODUCT_IMAGE } from "@/constants/generalconstants";

function generateOrderNumber(): string {
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return String(randNum);
}

function formatDate(dateObj: Date): string {
  return dateObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface ListOrdersServerParams {
  userId?: string;
  userRole?: string;
  page?: number;
  limit?: number;
  query?: string;
}

export async function listOrdersServer(params: ListOrdersServerParams) {
  const { userId, userRole, page = 1, limit = 10, query = "" } = params;

  const skip = (page - 1) * limit;

  const baseUserFilter = userRole === "ADMIN" ? {} : userId ? { userId } : { userId: "guest-or-none" };
  const searchFilter = query.trim()
    ? {
        OR: [
          { orderNumber: { contains: query.trim(), mode: "insensitive" as const } },
          { id: { contains: query.trim(), mode: "insensitive" as const } },
          { user: { name: { contains: query.trim(), mode: "insensitive" as const } } },
          { user: { email: { contains: query.trim(), mode: "insensitive" as const } } },
          { items: { some: { title: { contains: query.trim(), mode: "insensitive" as const } } } },
          {
            items: {
              some: {
                product: {
                  category: { name: { contains: query.trim(), mode: "insensitive" as const } },
                },
              },
            },
          },
        ],
      }
    : {};

  const whereClause = { ...baseUserFilter, ...searchFilter };
  const validOrdersWhere = { ...baseUserFilter, status: { not: "REJECTED" as const } };

  const [orders, totalCount, validOrdersAmountAgg, validOrderItemsAgg] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, email: true } },
        items: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: whereClause }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: validOrdersWhere,
    }),
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: { order: validOrdersWhere },
    }),
  ]);

  const totalAmountSum = Number(validOrdersAmountAgg._sum.totalAmount || 0);
  const totalUnitsSum = validOrderItemsAgg._sum.quantity || 0;

  const formattedOrders = orders.map((order) => {
    const uniqueProductCount = new Set(order.items.map((item) => item.productId)).size;
    return {
      id: order.id,
      date: formatDate(order.createdAt),
      orderNumber: order.orderNumber,
      user: order.user.name || "Customer",
      productsCount: uniqueProductCount || order.items.length,
      amount: Number(order.totalAmount),
      status: order.status,
    };
  });

  return {
    orders: formattedOrders,
    totalCount,
    totalUnits: totalUnitsSum,
    totalAmount: totalAmountSum,
    page,
    pageSize: limit,
  };
}

export async function createOrderServer(
  userId: string,
  itemIds?: string[],
  expectedTotal?: number
) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: { include: { variants: true } },
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

  if (!cart || cart.items.length === 0) {
    return { success: false as const, status: 400, errors: [], message: "Cannot place order with an empty cart" };
  }

  let targetItems = cart.items;
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    targetItems = cart.items.filter((item) => itemIds.includes(item.id));
  }

  if (targetItems.length === 0) {
    return { success: false as const, status: 400, errors: [], message: "No items selected to place order" };
  }

  const cartLines = targetItems.map((item) => {
    const unitPrice = Number(item.product.price);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    const imageUrl =
      item.variant?.images[0] ||
      item.product.variants[0]?.images[0] ||
      DEFAULT_PRODUCT_IMAGE;

    let itemTitle = item.product.name;
    if (item.variant?.variantOptions && item.variant.variantOptions.length > 0) {
      const optionsStr = item.variant.variantOptions
        .map((vo) => vo.optionValue.value)
        .filter(Boolean)
        .join(", ");
      if (optionsStr) {
        itemTitle = `${item.product.name} (${optionsStr})`;
      }
    }

    return {
      cartItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      title: itemTitle,
      price: unitPrice,
      quantity: item.quantity,
      totalPrice: lineTotal,
      imageUrl,
    };
  });

  const subTotal = Math.round(cartLines.reduce((acc, l) => acc + l.totalPrice, 0) * 100) / 100;
  const tax = Math.round(subTotal * TAX_RATE * 100) / 100;
  const totalAmount = Math.round((subTotal + tax) * 100) / 100;

  if (typeof expectedTotal === "number" && Math.abs(expectedTotal - totalAmount) > 0.01) {
    return {
      success: false as const,
      status: 409,
      errors: ["PRICE_CHANGED"],
      message: "Prices have updated. Please review your new total.",
      data: { newTotal: totalAmount },
    };
  }

  const orderNumber = generateOrderNumber();

  try {
    const createdOrder = await prisma.$transaction(async (tx) => {
      for (const line of cartLines) {
        const prod = await tx.product.findUnique({
          where: { id: line.productId },
          select: { isActive: true, name: true, variants: { select: { id: true } } },
        });
        if (!prod || !prod.isActive) {
          throw new Error(`INACTIVE_PRODUCT: ${line.title}`);
        }

        const isVariantDeleted =
          (line.variantId && !prod.variants.some((v) => v.id === line.variantId)) ||
          (!line.variantId && prod.variants.length > 0);

        if (isVariantDeleted) {
          throw new Error(`VARIANT_DELETED: ${line.title}`);
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: "IN_PROGRESS",
          subTotal,
          tax,
          totalAmount,
        },
      });

      for (const line of cartLines) {
        let currentStock = 50;

        if (line.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: line.variantId },
            select: { stock: true },
          });

          if (variant) {
            currentStock = variant.stock;
          }

          const updateResult = await tx.productVariant.updateMany({
            where: {
              id: line.variantId,
              stock: { gte: line.quantity },
            },
            data: {
              stock: { decrement: line.quantity },
            },
          });

          if (updateResult.count === 0) {
            throw new Error(`OUT_OF_STOCK:${line.title}:${currentStock}:${line.quantity}`);
          }
        }

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: line.productId,
            variantId: line.variantId || null,
            title: line.title,
            price: line.price,
            quantity: line.quantity,
            stock: currentStock,
            imageUrl: line.imageUrl,
          },
        });
      }

      const orderedCartItemIds = cartLines.map((l) => l.cartItemId);
      await tx.cartItem.deleteMany({
        where: { id: { in: orderedCartItemIds } },
      });

      return newOrder;
    });

    await prisma.notification.create({
      data: {
        userId,
        title: "Order Placed Successfully",
        message: `Your order #${createdOrder.orderNumber} has been placed.`,
        type: "ORDER_PLACED",
        orderId: createdOrder.id,
      },
    });

    return {
      success: true as const,
      status: 201,
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
    };
  } catch (error) {
    const errorMsg = (error as Error).message || "";
    if (errorMsg.startsWith("INACTIVE_PRODUCT")) {
      const prodName = errorMsg.split(":")[1]?.trim() || "Product";
      return {
        success: false as const,
        status: 400,
        errors: ["INACTIVE_PRODUCT"],
        message: `Order cannot be placed because '${prodName}' is currently inactive.`,
      };
    }
    if (errorMsg.startsWith("VARIANT_DELETED")) {
      const prodName = errorMsg.split(":")[1]?.trim() || "Item";
      return {
        success: false as const,
        status: 400,
        errors: ["VARIANT_DELETED"],
        message: `Item '${prodName}' does not exist anymore and was removed by the seller. Please update your cart.`,
      };
    }
    if (errorMsg.startsWith("OUT_OF_STOCK")) {
      const parts = errorMsg.split(":");
      const itemName = parts[1]?.trim() || "Item";
      const availableStock = parts[2] !== undefined ? parseInt(parts[2], 10) : null;
      const requestedQty = parts[3] !== undefined ? parseInt(parts[3], 10) : null;

      let message = `Order can't be placed because '${itemName}' is out of stock.`;
      if (availableStock !== null && availableStock > 0) {
        message = `Order can't be placed because only ${availableStock} unit(s) of '${itemName}' remain in stock (you requested ${requestedQty}). Please update your cart quantity.`;
      } else if (availableStock === 0) {
        message = `Order can't be placed because '${itemName}' is currently out of stock. Please update your cart quantity.`;
      }

      return {
        success: false as const,
        status: 400,
        errors: ["OUT_OF_STOCK"],
        message,
        data: {
          outOfStockItem: itemName,
          availableStock,
          requestedQty,
        },
      };
    }
    return { success: false as const, status: 500, errors: [errorMsg], message: "Failed to place order" };
  }
}

export async function getOrderByIdServer(id: string, userId?: string, userRole?: string) {
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
    return { success: false as const, status: 404, errors: [], message: "Order not found" };
  }

  if (userRole !== "ADMIN" && order.userId !== userId) {
    return { success: false as const, status: 403, errors: [], message: "Forbidden: Cannot access this order" };
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

  return { success: true as const, status: 200, order: formattedDetail };
}

const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  IN_PROGRESS: ["IN_PROGRESS", "DISPATCHED", "REJECTED"],
  DISPATCHED: ["DISPATCHED", "DELIVERED", "REJECTED"],
  DELIVERED: ["DELIVERED"],
  REJECTED: ["REJECTED"],
};

export async function updateOrderStatusServer(id: string, status: OrderStatus) {
  const validStatuses: OrderStatus[] = [
    "IN_PROGRESS",
    "DISPATCHED",
    "DELIVERED",
    "REJECTED",
  ];

  if (!validStatuses.includes(status)) {
    return { success: false as const, status: 400, errors: [], message: "Invalid status value" };
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingOrder) {
    return { success: false as const, status: 404, errors: [], message: "Order not found" };
  }

  const previousStatus = existingOrder.status;

  if (previousStatus === status) {
    return {
      success: true as const,
      status: 200,
      order: {
        id: existingOrder.id,
        status: existingOrder.status,
      },
    };
  }

  const allowedNext = ALLOWED_ORDER_TRANSITIONS[previousStatus] || [];
  if (!allowedNext.includes(status)) {
    let message = `Invalid status transition from ${previousStatus} to ${status}.`;
    if (previousStatus === "DELIVERED") {
      message = "Delivered orders cannot be modified or cancelled.";
    } else if (previousStatus === "REJECTED") {
      message = "Cancelled orders cannot be modified.";
    } else if (previousStatus === "DISPATCHED" && status === "IN_PROGRESS") {
      message = "Dispatched orders cannot be reverted back to In Progress.";
    }
    return {
      success: false as const,
      status: 400,
      errors: ["INVALID_STATUS_TRANSITION"],
      message,
    };
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
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

  await prisma.notification.create({
    data: {
      userId: existingOrder.userId,
      title: "Order Status Updated",
      message: `Your order #${existingOrder.orderNumber} is now ${readableStatus}.`,
      type: "ORDER_STATUS_UPDATED",
      orderId: updatedOrder.id,
    },
  });

  return {
    success: true as const,
    status: 200,
    order: {
      id: updatedOrder.id,
      status: updatedOrder.status,
    },
  };
}
