import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const TAX_RATE = 0.08;
const DEFAULT_PRODUCT_IMAGE = "/placeholder-product.png";

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

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const query = searchParams.get("query") || searchParams.get("search") || searchParams.get("q") || "";
    const skip = (page - 1) * limit;

    const baseUserFilter = user?.role === "ADMIN" ? {} : userId ? { userId } : { userId: "guest-or-none" };
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

    return apiSuccess("Orders retrieved successfully", {
      orders: formattedOrders,
      totalCount,
      totalUnits: totalUnitsSum,
      totalAmount: totalAmountSum,
      page,
      pageSize: limit,
    });
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

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: { include: { variants: true } },
            variant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return apiError("Cannot place order with an empty cart", [], 400);
    }

    let body: { itemIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      // Optional body
    }
    const { itemIds } = body;

    let targetItems = cart.items;
    if (Array.isArray(itemIds) && itemIds.length > 0) {
      targetItems = cart.items.filter((item) => itemIds.includes(item.id));
    }

    if (targetItems.length === 0) {
      return apiError("No items selected to place order", [], 400);
    }

    const cartLines = targetItems.map((item) => {
      const unitPrice = Number(item.product.price);

      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      const imageUrl =
        item.variant?.images[0] ||
        item.product.variants[0]?.images[0] ||
        DEFAULT_PRODUCT_IMAGE;

      return {
        cartItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        title: item.product.name,
        price: unitPrice,
        quantity: item.quantity,
        totalPrice: lineTotal,
        imageUrl,
      };
    });

    const subTotal = Math.round(cartLines.reduce((acc, l) => acc + l.totalPrice, 0) * 100) / 100;
    const tax = Math.round(subTotal * TAX_RATE * 100) / 100;
    const totalAmount = Math.round((subTotal + tax) * 100) / 100;

    const orderNumber = generateOrderNumber();

    const createdOrder = await prisma.$transaction(async (tx) => {
      // 1. Real-time active status & stock verification against current DB
      for (const line of cartLines) {
        const prod = await tx.product.findUnique({
          where: { id: line.productId },
          select: { isActive: true, name: true },
        });
        if (!prod || !prod.isActive) {
          throw new Error(`INACTIVE_PRODUCT: ${line.title}`);
        }

        if (line.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: line.variantId },
          });
          if (!variant || variant.stock < line.quantity || variant.stock <= 0) {
            throw new Error(`OUT_OF_STOCK: ${line.title}`);
          }
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
          });
          if (variant) {
            currentStock = variant.stock;
            const newVariantStock = variant.stock - line.quantity;
            await tx.productVariant.update({
              where: { id: line.variantId },
              data: { stock: newVariantStock },
            });
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

    // Create Notification for the user
    await prisma.notification.create({
      data: {
        userId,
        title: "Order Placed Successfully",
        message: `Your order #${createdOrder.orderNumber} has been placed.`,
        type: "ORDER_PLACED",
        orderId: createdOrder.id,
      },
    });

    return apiSuccess(
      "Order placed successfully",
      { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber },
      201
    );
  } catch (error) {
    const errorMsg = (error as Error).message || "";
    if (errorMsg.startsWith("INACTIVE_PRODUCT")) {
      const prodName = errorMsg.split(":")[1]?.trim() || "Product";
      return apiError(
        `Order cannot be placed because "${prodName}" is currently inactive.`,
        ["INACTIVE_PRODUCT"],
        400
      );
    }
    if (errorMsg.startsWith("OUT_OF_STOCK")) {
      return apiError(
        "Order can't be placed due to quantity going out of stock.",
        ["OUT_OF_STOCK"],
        400
      );
    }
    return apiError("Failed to place order", [errorMsg], 500);
  }
}
