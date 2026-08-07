import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const TAX_RATE = 0.08;
const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

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
    const skip = (page - 1) * limit;

    const whereClause = user?.role === "ADMIN" ? {} : userId ? { userId } : { userId: "guest-or-none" };

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      date: formatDate(order.createdAt),
      orderNumber: order.orderNumber,
      user: order.user.name || "Customer",
      productsCount: order.items.length,
      amount: Number(order.totalAmount),
      status: order.status,
    }));

    return apiSuccess("Orders retrieved successfully", {
      orders: formattedOrders,
      totalCount,
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
      const unitPrice = item.variant
        ? Number(item.variant.price)
        : item.product.variants[0]
        ? Number(item.product.variants[0].price)
        : 0;

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
            const newVariantStock = Math.max(0, variant.stock - line.quantity);
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

    return apiSuccess(
      "Order placed successfully",
      { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber },
      201
    );
  } catch (error) {
    return apiError("Failed to place order", [(error as Error).message], 500);
  }
}
