import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { TAX_RATE, DEFAULT_PRODUCT_IMAGE } from "@/constants/generalconstants";

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

    const unitPrice = Number(item.product.price);

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleQuantityUpdate(request, await params);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleQuantityUpdate(request, await params);
}

async function handleQuantityUpdate(
  request: Request,
  { id }: { id: string }
) {
  try {
    const body = await request.json();
    const { quantity } = body;

    if (typeof quantity !== "number" || quantity < 1) {
      return apiError("Quantity must be a positive integer", [], 400);
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
      include: {
        product: { include: { variants: true } },
        variant: true,
      },
    });

    if (!cartItem) {
      return apiError("Cart item not found", [], 404);
    }

    const availableStock = cartItem.variant
      ? cartItem.variant.stock
      : cartItem.product.variants[0]
        ? cartItem.product.variants[0].stock
        : 0;

    let targetQuantity = quantity;
    if (availableStock > 0 && targetQuantity > availableStock) {
      targetQuantity = availableStock;
    }

    await prisma.cartItem.update({
      where: { id },
      data: { quantity: targetQuantity },
    });

    const cartData = await formatCartResponse(cartItem.cartId);
    return apiSuccess("Cart item quantity updated", cartData);
  } catch (error) {
    return apiError("Failed to update item quantity", [(error as Error).message], 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
    });

    if (!cartItem) {
      return apiError("Cart item not found", [], 404);
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    const cartData = await formatCartResponse(cartItem.cartId);
    return apiSuccess("Cart item removed", cartData);
  } catch (error) {
    return apiError("Failed to remove item from cart", [(error as Error).message], 500);
  }
}
