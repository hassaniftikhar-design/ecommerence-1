import { prisma } from "@/lib/prisma";
import { TAX_RATE, DEFAULT_PRODUCT_IMAGE } from "@/constants/generalconstants";

export async function getOrCreateCartServer(userId: string) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
    });
  }
  return cart.id;
}

export async function formatCartResponseServer(cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            include: {
              variants: {
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

    const activeVariant = item.variant;

    if (activeVariant?.variantOptions) {
      for (const vo of activeVariant.variantOptions) {
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
    const imageUrl = item.variant?.images[0] || DEFAULT_PRODUCT_IMAGE;
    const itemStock = item.variant ? item.variant.stock : 0;

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

export async function getCartServer(userId: string) {
  const cartId = await getOrCreateCartServer(userId);
  return formatCartResponseServer(cartId);
}

export async function addToCartServer(
  userId: string,
  productId: string,
  variantId?: string,
  quantity: number = 1
) {
  const cartId = await getOrCreateCartServer(userId);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });

  if (!product) {
    return { success: false as const, status: 404, errors: [], message: "Product not found" };
  }

  if (!product.isActive) {
    return {
      success: false as const,
      status: 400,
      errors: [],
      message: "This product is inactive and cannot be added to cart.",
    };
  }

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

  const cartData = await formatCartResponseServer(cartId);
  return { success: true as const, status: 200, cartData, message: "Item added to cart successfully" };
}

export async function clearCartServer(userId: string) {
  const cartId = await getOrCreateCartServer(userId);

  await prisma.cartItem.deleteMany({
    where: { cartId },
  });

  const cartData = await formatCartResponseServer(cartId);
  return { success: true as const, status: 200, cartData, message: "Cart cleared successfully" };
}

export async function updateCartItemQuantityServer(id: string, quantity: number) {
  if (typeof quantity !== "number" || quantity < 1) {
    return { success: false as const, status: 400, errors: [], message: "Quantity must be a positive integer" };
  }

  const cartItem = await prisma.cartItem.findUnique({
    where: { id },
    include: {
      product: { include: { variants: true } },
      variant: true,
    },
  });

  if (!cartItem) {
    return { success: false as const, status: 404, errors: [], message: "Cart item not found" };
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

  const cartData = await formatCartResponseServer(cartItem.cartId);
  return { success: true as const, status: 200, cartData, message: "Cart item quantity updated" };
}

export async function removeCartItemServer(id: string) {
  const cartItem = await prisma.cartItem.findUnique({
    where: { id },
  });

  if (!cartItem) {
    return { success: false as const, status: 404, errors: [], message: "Cart item not found" };
  }

  await prisma.cartItem.delete({
    where: { id },
  });

  const cartData = await formatCartResponseServer(cartItem.cartId);
  return { success: true as const, status: 200, cartData, message: "Cart item removed" };
}
