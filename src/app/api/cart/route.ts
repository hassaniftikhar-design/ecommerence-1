import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const TAX_RATE = 0.08; // 8% Tax
const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

async function getOrCreateCart(request: Request): Promise<{ cartId: string; sessionIdCookie?: string }> {
  const user = await getCurrentUser(request);
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("cart_session_id")?.value;
  let newSessionId: string | undefined = undefined;

  if (user && (user.id || user.sub)) {
    const userId = (user.id || user.sub)!;
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }
    return { cartId: cart.id };
  } else {
    if (!sessionId) {
      sessionId = `sess_${randomBytes(16).toString("hex")}`;
      newSessionId = sessionId;
    }

    let cart = await prisma.cart.findUnique({
      where: { sessionId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { sessionId },
      });
    }

    return { cartId: cart.id, sessionIdCookie: newSessionId };
  }
}

async function formatCartResponse(cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            include: {
              variants: true,
            },
          },
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
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart) {
    return {
      items: [],
      totals: { subTotal: 0, tax: 0, total: 0 },
    };
  }

  const items = cart.items.map((item) => {
    let colorVal: string | undefined = undefined;
    let sizeVal: string | undefined = undefined;

    if (item.variant?.variantOptions) {
      for (const vo of item.variant.variantOptions) {
        const optName = vo.optionValue.option.name.toLowerCase();
        if (optName.includes("color") || optName.includes("colour")) {
          colorVal = vo.optionValue.value;
        } else if (optName.includes("size")) {
          sizeVal = vo.optionValue.value;
        }
      }
    }

    const unitPrice = item.variant
      ? Number(item.variant.price)
      : item.product.variants[0]
      ? Number(item.product.variants[0].price)
      : 0;

    const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;
    const imageUrl =
      item.variant?.images[0] ||
      item.product.variants[0]?.images[0] ||
      DEFAULT_PRODUCT_IMAGE;

    const itemStock = item.variant
      ? item.variant.stock
      : item.product.variants[0]
      ? item.product.variants[0].stock
      : 0;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.product.name,
      imageUrl,
      color: colorVal ? { name: colorVal } : undefined,
      size: sizeVal || "-",
      price: unitPrice,
      quantity: item.quantity,
      stock: itemStock,
      totalPrice,
    };
  });

  const subTotal = items.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const roundedSubTotal = Math.round(subTotal * 100) / 100;
  const tax = Math.round(roundedSubTotal * TAX_RATE * 100) / 100;
  const total = Math.round((roundedSubTotal + tax) * 100) / 100;

  return {
    cartId: cart.id,
    items,
    totals: {
      subTotal: roundedSubTotal,
      tax,
      total,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { cartId, sessionIdCookie } = await getOrCreateCart(request);
    const cartData = await formatCartResponse(cartId);

    const response = apiSuccess("Cart retrieved successfully", cartData);

    if (sessionIdCookie) {
      const cookieStore = await cookies();
      cookieStore.set("cart_session_id", sessionIdCookie, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error) {
    return apiError("Failed to fetch cart", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const { cartId, sessionIdCookie } = await getOrCreateCart(request);
    const body = await request.json();
    const { productId, variantId, quantity = 1 } = body;

    if (!productId) {
      return apiError("productId is required", [], 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product) {
      return apiError("Product not found", [], 404);
    }

    if (!product.isActive) {
      return apiError("This product is inactive and cannot be added to cart.", [], 400);
    }

    // Default to first variant if variantId not specified
    let targetVariantId = variantId;
    if (!targetVariantId && product.variants.length > 0) {
      targetVariantId = product.variants[0]?.id;
    }

    const targetVariant = product.variants.find((v) => v.id === targetVariantId) || product.variants[0];
    const availableStock = targetVariant ? targetVariant.stock : 0;

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
        variantId: targetVariantId || null,
      },
    });

    let newQty = (existingItem ? existingItem.quantity : 0) + Math.max(1, quantity);
    if (availableStock > 0 && newQty > availableStock) {
      newQty = availableStock;
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          variantId: targetVariantId || null,
          quantity: newQty,
        },
      });
    }

    const cartData = await formatCartResponse(cartId);
    const response = apiSuccess("Item added to cart successfully", cartData);

    if (sessionIdCookie) {
      const cookieStore = await cookies();
      cookieStore.set("cart_session_id", sessionIdCookie, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    return apiError("Failed to add item to cart", [(error as Error).message], 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { cartId } = await getOrCreateCart(request);

    await prisma.cartItem.deleteMany({
      where: { cartId },
    });

    const cartData = await formatCartResponse(cartId);
    return apiSuccess("Cart cleared successfully", cartData);
  } catch (error) {
    return apiError("Failed to clear cart", [(error as Error).message], 500);
  }
}
