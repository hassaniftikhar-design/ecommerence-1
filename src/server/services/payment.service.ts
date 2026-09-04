import type Stripe from 'stripe';

import { prisma } from '@/lib/prisma';
import { stripe, createOrGetStripeCustomer } from '@/lib/stripe/stripe-server';
import { logStripeError } from '@/lib/stripe/errors';
import { TAX_RATE, DEFAULT_PRODUCT_IMAGE } from '@/constants/generalconstants';
import {
  validateCreateOrderInput,
  validateSavePaymentMethodInput,
  validatePaymentMethodIdInput
} from '@/server/middlewares';

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
  idempotencyKey?: string;
}

export async function createCheckoutPaymentIntentServer(
  params: CreateCheckoutPaymentIntentParams
) {
  const { userId, itemIds, expectedTotal, savedPaymentMethodId, saveCardForFuture, idempotencyKey } = params;

  // 0. Check Checkout Idempotency
  if (idempotencyKey) {
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { order: true }
    });

    if (existingPayment) {
      if (existingPayment.stripePaymentIntentId) {
        try {
          const intent = await stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId);
          return {
            success: true as const,
            status: 200,
            clientSecret: intent.client_secret,
            orderId: existingPayment.order.id,
            orderNumber: existingPayment.order.orderNumber,
            amount: Number(existingPayment.amount)
          };
        } catch (err) {
          logStripeError('createCheckoutPaymentIntentServer:retrieveExisting', err, {
            idempotencyKey,
            paymentIntentId: existingPayment.stripePaymentIntentId
          });
        }
      }
    }
  }

  const validation = validateCreateOrderInput(itemIds, expectedTotal);
  if (!validation.success) {
    return validation;
  }

  const { itemIds: validItemIds, expectedTotal: validExpectedTotal } = validation.data;

  const [user, cart] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true }
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
                        option: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  ]);

  if (!user) {
    return { success: false as const, status: 401, errors: [], message: 'User not found or unauthenticated' };
  }

  if (!cart || cart.items.length === 0) {
    return { success: false as const, status: 400, errors: [], message: 'Cannot checkout with an empty cart' };
  }

  let targetItems = cart.items;
  if (Array.isArray(validItemIds) && validItemIds.length > 0) {
    targetItems = cart.items.filter((item) => validItemIds.includes(item.id));
  }

  if (targetItems.length === 0) {
    return { success: false as const, status: 400, errors: [], message: 'No items selected for checkout' };
  }

  const cartLines = targetItems.map((item) => {
    const imageUrl =
      item.variant?.images[0] ||
      item.product.variants[0]?.images[0] ||
      DEFAULT_PRODUCT_IMAGE;

    const unitPrice = Number(item.product.price);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    const itemTitle = item.product.name;

    return {
      cartItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      title: itemTitle,
      price: unitPrice,
      quantity: item.quantity,
      totalPrice: lineTotal,
      imageUrl
    };
  });

  const subTotal = Math.round(cartLines.reduce((acc, l) => acc + l.totalPrice, 0) * 100) / 100;
  const tax = Math.round(subTotal * TAX_RATE * 100) / 100;
  const totalAmount = Math.round((subTotal + tax) * 100) / 100;

  if (typeof validExpectedTotal === 'number' && Math.abs(validExpectedTotal - totalAmount) > 0.01) {
    return {
      success: false as const,
      status: 409,
      errors: ['PRICE_CHANGED'],
      message: 'Prices have updated. Please review your new total.',
      data: { newTotal: totalAmount }
    };
  }

  // Ensure Stripe Customer exists for this user
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    stripeCustomerId = await createOrGetStripeCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone
    });
  }

  let selectedStripePaymentMethodId: string | null = null;
  if (savedPaymentMethodId) {
    const savedCard = await prisma.paymentMethod.findFirst({
      where: {
        id: savedPaymentMethodId,
        userId: user.id
      }
    });

    if (savedCard) {
      selectedStripePaymentMethodId = savedCard.stripePaymentMethodId;
    }
  }

  const orderNumber = generateOrderNumber();

  let createdOrder: { id: string; orderNumber: string };
  let createdPayment: { id: string; attemptCount: number };

  // 1. PURE DB TRANSACTION (Create Order, OrderItems, reserve stock, Payment PENDING)
  try {
    const dbResult = await prisma.$transaction(async (tx) => {
      // Validate inventory and active status
      for (const line of cartLines) {
        const prod = await tx.product.findUnique({
          where: { id: line.productId },
          select: { isActive: true, name: true, variants: { select: { id: true } } }
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
          status: 'IN_PROGRESS',
          subTotal,
          tax,
          totalAmount
        }
      });

      // Atomically reserve stock and create order items
      for (const line of cartLines) {
        let targetVariantId = line.variantId;
        if (!targetVariantId) {
          const firstVariant = await tx.productVariant.findFirst({
            where: { productId: line.productId }
          });
          if (firstVariant) {
            targetVariantId = firstVariant.id;
          }
        }

        let currentStock = 0;
        if (targetVariantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: targetVariantId },
            select: { stock: true }
          });

          if (variant) {
            currentStock = variant.stock;
          }

          // Atomic conditional update prevents concurrency race conditions
          const updateResult = await tx.productVariant.updateMany({
            where: {
              id: targetVariantId,
              stock: { gte: line.quantity }
            },
            data: {
              stock: { decrement: line.quantity }
            }
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
            imageUrl: line.imageUrl
          }
        });
      }

      // Create Payment record with status PENDING, stripePaymentIntentId: null
      const newPayment = await tx.payment.create({
        data: {
          orderId: newOrder.id,
          status: 'PENDING',
          stripePaymentIntentId: null,
          stripePaymentMethodId: selectedStripePaymentMethodId,
          stripeCustomerId,
          idempotencyKey: idempotencyKey || null,
          attemptCount: 1,
          amount: totalAmount,
          currency: 'usd'
        }
      });

      return { newOrder, newPayment };
    });

    createdOrder = dbResult.newOrder;
    createdPayment = dbResult.newPayment;
  } catch (error) {
    const errorMsg = (error as Error).message || '';
    if (errorMsg.startsWith('INACTIVE_PRODUCT')) {
      const prodName = errorMsg.split(':')[1]?.trim() || 'Product';
      return {
        success: false as const,
        status: 400,
        errors: ['INACTIVE_PRODUCT'],
        message: `Order cannot be placed because '${prodName}' is currently inactive.`
      };
    }
    if (errorMsg.startsWith('VARIANT_DELETED')) {
      const prodName = errorMsg.split(':')[1]?.trim() || 'Item';
      return {
        success: false as const,
        status: 400,
        errors: ['VARIANT_DELETED'],
        message: `Item '${prodName}' does not exist anymore and was removed. Please update your cart.`
      };
    }
    if (errorMsg.startsWith('OUT_OF_STOCK')) {
      const parts = errorMsg.split(':');
      const itemName = parts[1]?.trim() || 'Item';
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
        errors: ['OUT_OF_STOCK'],
        message,
        data: {
          outOfStockItem: itemName,
          availableStock,
          requestedQty
        }
      };
    }

    // Check for unique constraint violation on idempotencyKey
    if ((error as { code?: string }).code === 'P2002' && idempotencyKey) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey },
        include: { order: true }
      });
      if (existingPayment && existingPayment.stripePaymentIntentId) {
        try {
          const intent = await stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId);
          return {
            success: true as const,
            status: 200,
            clientSecret: intent.client_secret,
            orderId: existingPayment.order.id,
            orderNumber: existingPayment.order.orderNumber,
            amount: Number(existingPayment.amount)
          };
        } catch {
          // Fall through to error
        }
      }
    }

    logStripeError('createCheckoutPaymentIntentServer:dbTransaction', error, { userId });
    return {
      success: false as const,
      status: 500,
      errors: [errorMsg],
      message: 'Failed to place order in database. Please try again.'
    };
  }

  // 2. CREATE STRIPE PAYMENTINTENT OUTSIDE TRANSACTION
  try {
    const stripeIdempotencyKey = `pi_attempt_${createdPayment.id}_${createdPayment.attemptCount}`;
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(totalAmount * 100),
      currency: 'usd',
      customer: stripeCustomerId || undefined,
      automatic_payment_methods: {
        enabled: true
      },
      metadata: {
        paymentId: createdPayment.id,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        userId: user.id,
        saveCardForFuture: saveCardForFuture ? 'true' : 'false'
      }
    };

    if (selectedStripePaymentMethodId) {
      paymentIntentParams.payment_method = selectedStripePaymentMethodId;
    }

    if (!selectedStripePaymentMethodId) {
      paymentIntentParams.setup_future_usage = 'off_session';
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey: stripeIdempotencyKey
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to obtain client secret from Stripe');
    }

    // Save Stripe PaymentIntent ID to Payment
    await prisma.payment.update({
      where: { id: createdPayment.id },
      data: { stripePaymentIntentId: paymentIntent.id }
    });

    return {
      success: true as const,
      status: 201,
      clientSecret: paymentIntent.client_secret,
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      amount: totalAmount
    };
  } catch (stripeError) {
    logStripeError('createCheckoutPaymentIntentServer:stripeIntentCreate', stripeError, {
      orderId: createdOrder.id,
      paymentId: createdPayment.id,
      userId
    });

    // The order and payment record exist in DB with status PENDING and can be paid again
    return {
      success: false as const,
      status: 500,
      errors: [(stripeError as Error).message],
      message: 'Failed to initialize payment with Stripe. Your order was created and can be paid again from your orders page.',
      data: {
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber
      }
    };
  }
}

export interface GetOrRefreshOrderPaymentIntentParams {
  orderId: string;
  userId: string;
  savedPaymentMethodId?: string;
}

export async function getOrRefreshOrderPaymentIntentServer(
  params: GetOrRefreshOrderPaymentIntentParams
) {
  const { orderId, userId, savedPaymentMethodId } = params;

  // 1. Fetch Order and Payment
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, price: true, isActive: true } },
          variant: { select: { id: true, stock: true } }
        }
      },
      payment: true,
      user: { select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true } }
    }
  });

  if (!order || order.userId !== userId) {
    return {
      success: false as const,
      status: 404,
      errors: ['ORDER_NOT_FOUND'],
      message: 'Order not found or you do not have permission to access it.'
    };
  }

  if (order.status === 'DELIVERED' || order.status === 'REJECTED') {
    return {
      success: false as const,
      status: 400,
      errors: ['ORDER_NOT_PAYABLE'],
      message: `Order cannot be paid because it is ${order.status.toLowerCase()}.`
    };
  }

  if (order.payment?.status === 'SUCCEEDED') {
    return {
      success: true as const,
      status: 200,
      isPaid: true,
      message: 'Order is already paid.'
    };
  }

  let payment = order.payment;
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        amount: order.totalAmount,
        currency: 'usd',
        stripeCustomerId: order.user.stripeCustomerId,
        attemptCount: 1
      }
    });
  }

  // Validate saved card ownership if passed
  let selectedStripePaymentMethodId: string | null = null;
  if (savedPaymentMethodId) {
    const savedCard = await prisma.paymentMethod.findFirst({
      where: { id: savedPaymentMethodId, userId }
    });
    if (savedCard) {
      selectedStripePaymentMethodId = savedCard.stripePaymentMethodId;
    }
  }

  let stripeCustomerId = order.user.stripeCustomerId;
  if (!stripeCustomerId) {
    stripeCustomerId = await createOrGetStripeCustomer({
      userId: order.user.id,
      email: order.user.email,
      name: order.user.name,
      phone: order.user.phone
    });
  }

  // 2. STRIPE CHECK FIRST (Before any stock changes)
  let existingIntent: Stripe.PaymentIntent | null = null;
  if (payment.stripePaymentIntentId) {
    try {
      existingIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    } catch (retrieveErr) {
      logStripeError('getOrRefreshOrderPaymentIntentServer:retrieve', retrieveErr, {
        paymentIntentId: payment.stripePaymentIntentId
      });
    }
  }

  if (existingIntent) {
    if (existingIntent.status === 'succeeded') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', paidAt: new Date(), stripePaymentIntentId: existingIntent.id }
      });
      return {
        success: true as const,
        status: 200,
        isPaid: true,
        message: 'Order is already paid.'
      };
    }

    if (existingIntent.status === 'processing') {
      return {
        success: false as const,
        status: 409,
        errors: ['PAYMENT_PROCESSING'],
        message: 'Payment is currently processing. Please wait for confirmation.'
      };
    }
  }

  // 3. PRICE & STOCK VALIDATION + ATOMIC RE-RESERVATION (Short DB Transaction)
  try {
    await prisma.$transaction(async (tx) => {
      // Validate product prices & active status
      for (const item of order.items) {
        if (!item.product || !item.product.isActive) {
          throw new Error(`INACTIVE_PRODUCT:${item.title}`);
        }

        const currentPrice = Number(item.product.price);
        const orderPrice = Number(item.price);
        if (Math.abs(currentPrice - orderPrice) > 0.01) {
          throw new Error(`PRICE_CHANGED:${item.productId}:${orderPrice}:${currentPrice}`);
        }

        // If payment was FAILED, stock was restored on failure, so re-reserve stock
        if (payment.status === 'FAILED' && item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stock: true }
          });
          const available = variant ? variant.stock : 0;
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } }
          });
          if (updated.count === 0) {
            throw new Error(`OUT_OF_STOCK:${item.title}:${available}:${item.quantity}`);
          }
        }
      }

      // Update payment status to PENDING
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PENDING' }
      });
    });
  } catch (err) {
    const errorMsg = (err as Error).message || '';
    if (errorMsg.startsWith('PRICE_CHANGED')) {
      const [, productId, oldPrice, currentPrice] = errorMsg.split(':');
      return {
        success: false as const,
        status: 409,
        errors: ['PRICE_CHANGED'],
        message: 'Product prices have changed since this order was placed. Please review your cart.',
        data: { productId, oldPrice: Number(oldPrice), currentPrice: Number(currentPrice) }
      };
    }
    if (errorMsg.startsWith('OUT_OF_STOCK')) {
      const [, itemName, availableStock, requestedQty] = errorMsg.split(':');
      return {
        success: false as const,
        status: 400,
        errors: ['OUT_OF_STOCK'],
        message: `Item '${itemName}' is out of stock or does not have enough quantity remaining.`,
        data: { outOfStockItem: itemName, availableStock: Number(availableStock), requestedQty: Number(requestedQty) }
      };
    }
    if (errorMsg.startsWith('INACTIVE_PRODUCT')) {
      const [, prodName] = errorMsg.split(':');
      return {
        success: false as const,
        status: 400,
        errors: ['INACTIVE_PRODUCT'],
        message: `Product '${prodName}' is no longer available.`
      };
    }
    throw err;
  }

  // 4. STRIPE INTENT REUSE OR ATOMIC CREATION
  if (existingIntent && (existingIntent.status === 'requires_payment_method' || existingIntent.status === 'requires_action')) {
    // REUSE existing intent
    return {
      success: true as const,
      status: 200,
      clientSecret: existingIntent.client_secret,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.totalAmount)
    };
  }

  // If intent was canceled or null, create a new intent safely using atomic claim
  let targetAttemptCount = payment.attemptCount;
  if (existingIntent && existingIntent.status === 'canceled') {
    const claim = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        attemptCount: payment.attemptCount,
        status: { notIn: ['PROCESSING', 'SUCCEEDED'] }
      },
      data: {
        attemptCount: { increment: 1 }
      }
    });

    if (claim.count === 1) {
      targetAttemptCount = payment.attemptCount + 1;
    } else {
      const refreshedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      if (refreshedPayment) {
        targetAttemptCount = refreshedPayment.attemptCount;
      }
    }
  }

  const stripeIdempotencyKey = `pi_attempt_${payment.id}_${targetAttemptCount}`;
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: Math.round(Number(order.totalAmount) * 100),
    currency: 'usd',
    customer: stripeCustomerId || undefined,
    automatic_payment_methods: { enabled: true },
    metadata: {
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId
    }
  };

  if (selectedStripePaymentMethodId) {
    paymentIntentParams.payment_method = selectedStripePaymentMethodId;
  }

  try {
    const newPaymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey: stripeIdempotencyKey
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripePaymentIntentId: newPaymentIntent.id,
        status: 'PENDING'
      }
    });

    return {
      success: true as const,
      status: 200,
      clientSecret: newPaymentIntent.client_secret,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.totalAmount)
    };
  } catch (stripeErr) {
    logStripeError('getOrRefreshOrderPaymentIntentServer:stripeCreate', stripeErr, {
      orderId: order.id,
      paymentId: payment.id
    });
    return {
      success: false as const,
      status: 500,
      errors: [(stripeErr as Error).message],
      message: 'Failed to initialize payment with Stripe. Please try again.'
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
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    const formatted = paymentMethods.map((pm) => ({
      id: pm.id,
      stripePaymentMethodId: pm.stripePaymentMethodId,
      brand: pm.brand,
      last4: pm.last4,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      isDefault: pm.isDefault,
      createdAt: pm.createdAt.toISOString()
    }));

    return {
      success: true as const,
      status: 200,
      message: 'Payment methods retrieved successfully',
      data: {
        paymentMethods: formatted
      }
    };
  } catch (error) {
    logStripeError('getSavedPaymentMethodsServer', error, { userId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: 'Failed to fetch payment methods'
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
        errors: ['Invalid payment method'],
        message: 'The provided payment method is not a card'
      };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true }
    });

    if (!dbUser) {
      return {
        success: false as const,
        status: 404,
        errors: ['User not found'],
        message: 'User not found'
      };
    }

    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      customerId = await createOrGetStripeCustomer({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        phone: dbUser.phone
      });
    }

    // 2. Attach payment method to customer if not already attached
    if (customerId && pm.customer !== customerId) {
      await stripe.paymentMethods.attach(validPaymentMethodId, {
        customer: customerId
      });
    }

    const existingCardsCount = await prisma.paymentMethod.count({
      where: { userId }
    });

    const isFirstCard = existingCardsCount === 0;
    const shouldBeDefault = shouldBeDefaultInput || isFirstCard;

    if (shouldBeDefault && customerId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: validPaymentMethodId
          }
        });
      } catch (stripeErr) {
        logStripeError('savePaymentMethodServer:setDefaultOnStripe', stripeErr, { customerId });
      }
    }

    // 3. Save locally in DB
    const savedCard = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false }
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
          isDefault: shouldBeDefault
        },
        update: {
          brand: pm.card!.brand,
          last4: pm.card!.last4,
          expMonth: pm.card!.exp_month,
          expYear: pm.card!.exp_year,
          isDefault: shouldBeDefault
        }
      });
    });

    return {
      success: true as const,
      status: 201,
      message: 'Payment method saved successfully',
      data: {
        paymentMethod: {
          id: savedCard.id,
          stripePaymentMethodId: savedCard.stripePaymentMethodId,
          brand: savedCard.brand,
          last4: savedCard.last4,
          expMonth: savedCard.expMonth,
          expYear: savedCard.expYear,
          isDefault: savedCard.isDefault,
          createdAt: savedCard.createdAt.toISOString()
        }
      }
    };
  } catch (error) {
    logStripeError('savePaymentMethodServer', error, { userId, paymentMethodId: validPaymentMethodId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: 'Failed to save payment method'
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
        userId
      },
      include: {
        user: { select: { stripeCustomerId: true } }
      }
    });

    if (!card) {
      return {
        success: false as const,
        status: 404,
        errors: ['Payment method not found'],
        message: 'Payment method not found'
      };
    }

    // 1. Detach from Stripe
    try {
      await stripe.paymentMethods.detach(card.stripePaymentMethodId);
    } catch (stripeErr) {
      logStripeError('deletePaymentMethodServer:detach', stripeErr, {
        paymentMethodId: card.stripePaymentMethodId
      });
    }

    // 2. Delete local record and reassign default if needed
    await prisma.$transaction(async (tx) => {
      await tx.paymentMethod.delete({
        where: { id: card.id }
      });

      if (card.isDefault) {
        const nextCard = await tx.paymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        });

        if (nextCard) {
          await tx.paymentMethod.update({
            where: { id: nextCard.id },
            data: { isDefault: true }
          });

          if (card.user.stripeCustomerId) {
            try {
              await stripe.customers.update(card.user.stripeCustomerId, {
                invoice_settings: {
                  default_payment_method: nextCard.stripePaymentMethodId
                }
              });
            } catch (updateErr) {
              logStripeError('deletePaymentMethodServer:reassignDefault', updateErr);
            }
          }
        }
      }
    });

    return {
      success: true as const,
      status: 200,
      message: 'Payment method deleted successfully'
    };
  } catch (error) {
    logStripeError('deletePaymentMethodServer', error, { userId, paymentMethodRecordId: validId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: 'Failed to delete payment method'
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
        userId
      },
      include: {
        user: { select: { stripeCustomerId: true } }
      }
    });

    if (!card) {
      return {
        success: false as const,
        status: 404,
        errors: ['Payment method not found'],
        message: 'Payment method not found'
      };
    }

    // Update default payment method on Stripe
    if (card.user.stripeCustomerId) {
      try {
        await stripe.customers.update(card.user.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: card.stripePaymentMethodId
          }
        });
      } catch (stripeErr) {
        logStripeError('setDefaultPaymentMethodServer:stripeCustomerUpdate', stripeErr, {
          customerId: card.user.stripeCustomerId,
          paymentMethodId: card.stripePaymentMethodId
        });
      }
    }

    // Update isDefault in DB transaction
    await prisma.$transaction(async (tx) => {
      await tx.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false }
      });

      await tx.paymentMethod.update({
        where: { id: card.id },
        data: { isDefault: true }
      });
    });

    return {
      success: true as const,
      status: 200,
      message: 'Default payment method updated successfully'
    };
  } catch (error) {
    logStripeError('setDefaultPaymentMethodServer', error, { userId, paymentMethodRecordId: validId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: 'Failed to update default payment method'
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
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true }
    });

    if (!dbUser) {
      return {
        success: false as const,
        status: 404,
        errors: ['User not found'],
        message: 'User not found'
      };
    }

    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      customerId = await createOrGetStripeCustomer({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        phone: dbUser.phone
      });
    }

    if (!customerId) {
      return {
        success: false as const,
        status: 500,
        errors: ['Customer initialization failed'],
        message: 'Failed to initialize Stripe customer'
      };
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: {
        enabled: true
      },
      metadata: {
        userId
      }
    });

    if (!setupIntent.client_secret) {
      return {
        success: false as const,
        status: 500,
        errors: ['Missing client secret'],
        message: 'Failed to create setup intent'
      };
    }

    return {
      success: true as const,
      status: 200,
      message: 'Setup intent created successfully',
      data: {
        clientSecret: setupIntent.client_secret
      }
    };
  } catch (error) {
    logStripeError('createSetupIntentServer', error, { userId });
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: 'Failed to initialize payment setup'
    };
  }
}

