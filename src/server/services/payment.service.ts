import { prisma } from "@/lib/prisma";
import { stripe, createOrGetStripeCustomer } from "@/lib/stripe/stripe-server";
import { logStripeError } from "@/lib/stripe/errors";
import { TAX_RATE, DEFAULT_PRODUCT_IMAGE } from "@/constants/generalconstants";
import {
  validateCreateOrderInput,
  validateSavePaymentMethodInput,
  validatePaymentMethodIdInput,
} from "@/server/middlewares";
import type Stripe from "stripe";

function generateOrderNumber(): string {
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return String(randNum);
}

export interface CreateCheckoutPaymentIntentParams {
  userId: string;
  itemIds?: string[];
  expectedTotal?: number;
  savedPaymentMethodId?: string;
  saveCardForFuture?: boolean;
}

export async function createCheckoutPaymentIntentServer(
  params: CreateCheckoutPaymentIntentParams
) {
  const { userId, itemIds, expectedTotal, savedPaymentMethodId, saveCardForFuture } = params;

  const validation = validateCreateOrderInput(itemIds, expectedTotal);
  if (!validation.success) {
    return validation;
  }

  const { itemIds: validItemIds, expectedTotal: validExpectedTotal } = validation.data;

  const [user, cart] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true },
    }),
    prisma.cart.findUnique({
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
    }),
  ]);

  if (!user) {
    return { success: false as const, status: 401, errors: [], message: "User not found or unauthenticated" };
  }

  if (!cart || cart.items.length === 0) {
    return { success: false as const, status: 400, errors: [], message: "Cannot checkout with an empty cart" };
  }

  let targetItems = cart.items;
  if (Array.isArray(validItemIds) && validItemIds.length > 0) {
    targetItems = cart.items.filter((item) => validItemIds.includes(item.id));
  }

  if (targetItems.length === 0) {
    return { success: false as const, status: 400, errors: [], message: "No items selected for checkout" };
  }

  const cartLines = targetItems.map((item) => {
    const imageUrl =
      item.variant?.images[0] ||
      item.product.variants[0]?.images[0] ||
      DEFAULT_PRODUCT_IMAGE;

    const unitPrice = Number(item.product.price);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;

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

  if (typeof validExpectedTotal === "number" && Math.abs(validExpectedTotal - totalAmount) > 0.01) {
    return {
      success: false as const,
      status: 409,
      errors: ["PRICE_CHANGED"],
      message: "Prices have updated. Please review your new total.",
      data: { newTotal: totalAmount },
    };
  }

  // Ensure Stripe Customer exists for this user
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    stripeCustomerId = await createOrGetStripeCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    });
  }

  let selectedStripePaymentMethodId: string | null = null;
  if (savedPaymentMethodId) {
    const savedCard = await prisma.paymentMethod.findFirst({
      where: {
        id: savedPaymentMethodId,
        userId: user.id,
      },
    });

    if (savedCard) {
      selectedStripePaymentMethodId = savedCard.stripePaymentMethodId;
    }
  }

  const orderNumber = generateOrderNumber();

  try {
    // 1. Create Stripe PaymentIntent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(totalAmount * 100), // Amount in cents
      currency: "usd",
      customer: stripeCustomerId || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderNumber,
        userId: user.id,
        saveCardForFuture: saveCardForFuture ? "true" : "false",
      },
    };

    if (selectedStripePaymentMethodId) {
      paymentIntentParams.payment_method = selectedStripePaymentMethodId;
    }

    if (!selectedStripePaymentMethodId) {
      paymentIntentParams.setup_future_usage = "off_session";
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    if (!paymentIntent.client_secret) {
      throw new Error("Failed to obtain client secret from Stripe");
    }

    // 2. Create Order & Payment in DB transaction
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Validate inventory
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

      // Update metadata on PaymentIntent with the generated order ID
      try {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: {
            orderId: newOrder.id,
            orderNumber: newOrder.orderNumber,
            userId,
          },
        });
      } catch (metaErr) {
        logStripeError("createCheckoutPaymentIntentServer:updateMetadata", metaErr, {
          paymentIntentId: paymentIntent.id,
          orderId: newOrder.id,
        });
      }

      // Atomically reserve stock and create order items
      for (const line of cartLines) {
        let targetVariantId = line.variantId;
        if (!targetVariantId) {
          const firstVariant = await tx.productVariant.findFirst({
            where: { productId: line.productId },
          });
          if (firstVariant) {
            targetVariantId = firstVariant.id;
          }
        }

        let currentStock = 0;
        if (targetVariantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: targetVariantId },
            select: { stock: true },
          });

          if (variant) {
            currentStock = variant.stock;
          }

          // Atomic conditional update prevents concurrency race conditions
          const updateResult = await tx.productVariant.updateMany({
            where: {
              id: targetVariantId,
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
            variantId: targetVariantId || null,
            title: line.title,
            price: line.price,
            quantity: line.quantity,
            stock: currentStock,
            imageUrl: line.imageUrl,
          },
        });
      }

      // Create Payment record with status PENDING
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          status: "PENDING",
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentMethodId: selectedStripePaymentMethodId,
          stripeCustomerId,
          amount: totalAmount,
          currency: "usd",
        },
      });

      return newOrder;
    });

    return {
      success: true as const,
      status: 201,
      clientSecret: paymentIntent.client_secret,
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      amount: totalAmount,
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
        message: `Item '${prodName}' does not exist anymore and was removed. Please update your cart.`,
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

    logStripeError("createCheckoutPaymentIntentServer", error, { userId });
    return {
      success: false as const,
      status: 500,
      errors: [errorMsg],
      message: "Failed to initialize payment for checkout. Please try again.",
    };
  }
}

/**
 * Retrieves all saved payment methods for a user from database.
 */
export async function getSavedPaymentMethodsServer(userId: string) {
  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    const formatted = paymentMethods.map((pm) => ({
      id: pm.id,
      stripePaymentMethodId: pm.stripePaymentMethodId,
      brand: pm.brand,
      last4: pm.last4,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      isDefault: pm.isDefault,
      createdAt: pm.createdAt.toISOString(),
    }));

    return {
      success: true as const,
      status: 200,
      message: "Payment methods retrieved successfully",
      data: {
        paymentMethods: formatted,
      },
    };
  } catch (error) {
    logStripeError("getSavedPaymentMethodsServer", error, { userId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: "Failed to fetch payment methods",
    };
  }
}

/**
 * Saves a payment method card to Stripe and local database.
 */
export async function savePaymentMethodServer(
  userId: string,
  paymentMethodId: unknown,
  setAsDefault?: unknown
) {
  const validation = validateSavePaymentMethodInput(paymentMethodId, setAsDefault);
  if (!validation.success) {
    return validation;
  }

  const { paymentMethodId: validPaymentMethodId, setAsDefault: shouldBeDefaultInput } = validation.data;

  try {
    // 1. Retrieve card details from Stripe
    const pm = await stripe.paymentMethods.retrieve(validPaymentMethodId);
    if (!pm.card) {
      return {
        success: false as const,
        status: 400,
        errors: ["Invalid payment method"],
        message: "The provided payment method is not a card",
      };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true },
    });

    if (!dbUser) {
      return {
        success: false as const,
        status: 404,
        errors: ["User not found"],
        message: "User not found",
      };
    }

    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      customerId = await createOrGetStripeCustomer({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        phone: dbUser.phone,
      });
    }

    // 2. Attach payment method to customer if not already attached
    if (customerId && pm.customer !== customerId) {
      await stripe.paymentMethods.attach(validPaymentMethodId, {
        customer: customerId,
      });
    }

    const existingCardsCount = await prisma.paymentMethod.count({
      where: { userId },
    });

    const isFirstCard = existingCardsCount === 0;
    const shouldBeDefault = shouldBeDefaultInput || isFirstCard;

    if (shouldBeDefault && customerId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: validPaymentMethodId,
          },
        });
      } catch (stripeErr) {
        logStripeError("savePaymentMethodServer:setDefaultOnStripe", stripeErr, { customerId });
      }
    }

    // 3. Save locally in DB
    const savedCard = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.paymentMethod.upsert({
        where: { stripePaymentMethodId: validPaymentMethodId },
        create: {
          userId,
          stripePaymentMethodId: validPaymentMethodId,
          brand: pm.card!.brand,
          last4: pm.card!.last4,
          expMonth: pm.card!.exp_month,
          expYear: pm.card!.exp_year,
          isDefault: shouldBeDefault,
        },
        update: {
          brand: pm.card!.brand,
          last4: pm.card!.last4,
          expMonth: pm.card!.exp_month,
          expYear: pm.card!.exp_year,
          isDefault: shouldBeDefault,
        },
      });
    });

    return {
      success: true as const,
      status: 201,
      message: "Payment method saved successfully",
      data: {
        paymentMethod: {
          id: savedCard.id,
          stripePaymentMethodId: savedCard.stripePaymentMethodId,
          brand: savedCard.brand,
          last4: savedCard.last4,
          expMonth: savedCard.expMonth,
          expYear: savedCard.expYear,
          isDefault: savedCard.isDefault,
          createdAt: savedCard.createdAt.toISOString(),
        },
      },
    };
  } catch (error) {
    logStripeError("savePaymentMethodServer", error, { userId, paymentMethodId: validPaymentMethodId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: "Failed to save payment method",
    };
  }
}

/**
 * Deletes a saved payment method card from Stripe and local database.
 */
export async function deletePaymentMethodServer(userId: string, paymentMethodRecordId: unknown) {
  const validation = validatePaymentMethodIdInput(paymentMethodRecordId);
  if (!validation.success) {
    return validation;
  }

  const validId = validation.data;

  try {
    const card = await prisma.paymentMethod.findFirst({
      where: {
        id: validId,
        userId,
      },
      include: {
        user: { select: { stripeCustomerId: true } },
      },
    });

    if (!card) {
      return {
        success: false as const,
        status: 404,
        errors: ["Payment method not found"],
        message: "Payment method not found",
      };
    }

    // 1. Detach from Stripe
    try {
      await stripe.paymentMethods.detach(card.stripePaymentMethodId);
    } catch (stripeErr) {
      logStripeError("deletePaymentMethodServer:detach", stripeErr, {
        paymentMethodId: card.stripePaymentMethodId,
      });
    }

    // 2. Delete local record and reassign default if needed
    await prisma.$transaction(async (tx) => {
      await tx.paymentMethod.delete({
        where: { id: card.id },
      });

      if (card.isDefault) {
        const nextCard = await tx.paymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });

        if (nextCard) {
          await tx.paymentMethod.update({
            where: { id: nextCard.id },
            data: { isDefault: true },
          });

          if (card.user.stripeCustomerId) {
            try {
              await stripe.customers.update(card.user.stripeCustomerId, {
                invoice_settings: {
                  default_payment_method: nextCard.stripePaymentMethodId,
                },
              });
            } catch (updateErr) {
              logStripeError("deletePaymentMethodServer:reassignDefault", updateErr);
            }
          }
        }
      }
    });

    return {
      success: true as const,
      status: 200,
      message: "Payment method deleted successfully",
    };
  } catch (error) {
    logStripeError("deletePaymentMethodServer", error, { userId, paymentMethodRecordId: validId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: "Failed to delete payment method",
    };
  }
}

/**
 * Updates a saved card as the default payment method.
 */
export async function setDefaultPaymentMethodServer(userId: string, paymentMethodRecordId: unknown) {
  const validation = validatePaymentMethodIdInput(paymentMethodRecordId);
  if (!validation.success) {
    return validation;
  }

  const validId = validation.data;

  try {
    const card = await prisma.paymentMethod.findFirst({
      where: {
        id: validId,
        userId,
      },
      include: {
        user: { select: { stripeCustomerId: true } },
      },
    });

    if (!card) {
      return {
        success: false as const,
        status: 404,
        errors: ["Payment method not found"],
        message: "Payment method not found",
      };
    }

    // Update default payment method on Stripe
    if (card.user.stripeCustomerId) {
      try {
        await stripe.customers.update(card.user.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: card.stripePaymentMethodId,
          },
        });
      } catch (stripeErr) {
        logStripeError("setDefaultPaymentMethodServer:stripeCustomerUpdate", stripeErr, {
          customerId: card.user.stripeCustomerId,
          paymentMethodId: card.stripePaymentMethodId,
        });
      }
    }

    // Update isDefault in DB transaction
    await prisma.$transaction(async (tx) => {
      await tx.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await tx.paymentMethod.update({
        where: { id: card.id },
        data: { isDefault: true },
      });
    });

    return {
      success: true as const,
      status: 200,
      message: "Default payment method updated successfully",
    };
  } catch (error) {
    logStripeError("setDefaultPaymentMethodServer", error, { userId, paymentMethodRecordId: validId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: "Failed to update default payment method",
    };
  }
}

/**
 * Creates a Stripe SetupIntent for saving a new card.
 */
export async function createSetupIntentServer(userId: string) {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true },
    });

    if (!dbUser) {
      return {
        success: false as const,
        status: 404,
        errors: ["User not found"],
        message: "User not found",
      };
    }

    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      customerId = await createOrGetStripeCustomer({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        phone: dbUser.phone,
      });
    }

    if (!customerId) {
      return {
        success: false as const,
        status: 500,
        errors: ["Customer initialization failed"],
        message: "Failed to initialize Stripe customer",
      };
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
      },
    });

    if (!setupIntent.client_secret) {
      return {
        success: false as const,
        status: 500,
        errors: ["Missing client secret"],
        message: "Failed to create setup intent",
      };
    }

    return {
      success: true as const,
      status: 200,
      message: "Setup intent created successfully",
      data: {
        clientSecret: setupIntent.client_secret,
      },
    };
  } catch (error) {
    logStripeError("createSetupIntentServer", error, { userId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: "Failed to initialize payment setup",
    };
  }
}

