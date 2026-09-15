import type Stripe from 'stripe';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/stripe-server';
import { getFriendlyPaymentErrorMessage, logStripeError } from '@/lib/stripe/errors';
import { validateStripeWebhookInput } from '@/server/middlewares';
import { createAndEmitNotificationServer } from '@/server/services/notification.service';

/**
 * Resolves the Payment entity for a PaymentIntent with robust metadata fallback
 * and strict security verification.
 */
async function findAndValidatePaymentForIntent(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;

  // Primary lookup by stripePaymentIntentId
  let payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      order: {
        include: {
          items: true
        }
      }
    }
  });

  // Fallback lookup via metadata if webhook arrives before backend saved stripePaymentIntentId
  if (!payment && (paymentIntent.metadata?.paymentId || paymentIntent.metadata?.orderId)) {
    payment = await prisma.payment.findFirst({
      where: {
        OR: [
          paymentIntent.metadata.paymentId ? { id: paymentIntent.metadata.paymentId } : undefined,
          paymentIntent.metadata.orderId ? { orderId: paymentIntent.metadata.orderId } : undefined
        ].filter(Boolean) as Array<{ id?: string; orderId?: string }>
      },
      include: {
        order: {
          include: {
            items: true
          }
        }
      }
    });

    // Strict validation on fallback match
    if (payment) {
      const expectedAmount = Math.round(Number(payment.amount) * 100);
      const isAmountValid = Math.abs(expectedAmount - paymentIntent.amount) <= 1;
      const isCurrencyValid = payment.currency.toLowerCase() === paymentIntent.currency.toLowerCase();
      const isOrderValid = !paymentIntent.metadata.orderId || payment.orderId === paymentIntent.metadata.orderId;

      if (!isAmountValid || !isCurrencyValid || !isOrderValid) {
        logStripeError('findAndValidatePaymentForIntent:validationMismatch', new Error('Metadata payment validation failed'), {
          paymentIntentId,
          paymentId: payment.id,
          expectedAmount,
          intentAmount: paymentIntent.amount
        });
        return null;
      }

      // Populate stripePaymentIntentId on DB Payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripePaymentIntentId: paymentIntentId }
      });
    }
  }

  return payment;
}

/**
 * Handles payment_intent.processing event:
 * Sets Payment.status = PROCESSING.
 */
async function handlePaymentIntentProcessing(paymentIntent: Stripe.PaymentIntent) {
  const payment = await findAndValidatePaymentForIntent(paymentIntent);
  if (!payment) return;

  if (payment.status !== 'SUCCEEDED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PROCESSING',
        stripePaymentIntentId: paymentIntent.id
      }
    });
  }
}

/**
 * Handles payment_intent.succeeded event:
 * Sets Payment.status = SUCCEEDED, paidAt = now(), saves PaymentMethod if requested.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const paymentMethodId =
    typeof paymentIntent.payment_method === 'string'
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id || null;

  const payment = await findAndValidatePaymentForIntent(paymentIntent);

  if (!payment) {
    logStripeError('handlePaymentIntentSucceeded:paymentNotFound', new Error('Payment record not found for PaymentIntent'), {
      paymentIntentId,
      metadata: paymentIntent.metadata
    });
    return;
  }

  // Update Payment record
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCEEDED',
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      stripePaymentMethodId: paymentMethodId,
      errorMessage: null,
      rawErrorCode: null
    }
  });

  // If user opted to save card for future purchases
  const userId = paymentIntent.metadata?.userId || payment.order.userId;
  const saveCard = paymentIntent.metadata?.saveCardForFuture === 'true';

  if (saveCard && paymentMethodId && userId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.card) {
        const existingCard = await prisma.paymentMethod.findFirst({
          where: {
            userId,
            OR: [
              { stripePaymentMethodId: paymentMethodId },
              {
                brand: { equals: pm.card.brand, mode: 'insensitive' },
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year
              }
            ]
          }
        });

        if (!existingCard) {
          const userCardCount = await prisma.paymentMethod.count({
            where: { userId }
          });

          await prisma.paymentMethod.create({
            data: {
              userId,
              stripePaymentMethodId: paymentMethodId,
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              isDefault: userCardCount === 0 // Make default if it's the user's first saved card
            }
          });
        }
      }
    } catch (saveErr) {
      logStripeError('handlePaymentIntentSucceeded:savePaymentMethod', saveErr, {
        userId,
        paymentMethodId
      });
    }
  }

  // Remove only matching ordered items from user's cart if any remain
  try {
    const userCart = await prisma.cart.findUnique({
      where: { userId: payment.order.userId },
      include: { items: true }
    });
    if (userCart && userCart.items && userCart.items.length > 0 && payment.order.items) {
      const orderItems = payment.order.items;
      const matchingCartItemIds = userCart.items
        .filter((cItem) =>
          orderItems.some(
            (oItem) =>
              oItem.productId === cItem.productId &&
              (oItem.variantId || null) === (cItem.variantId || null)
          )
        )
        .map((ci) => ci.id);

      if (matchingCartItemIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: {
            cartId: userCart.id,
            id: { in: matchingCartItemIds }
          }
        });
      }
    }
  } catch (cartErr) {
    logStripeError('handlePaymentIntentSucceeded:clearCart', cartErr, {
      userId: payment.order.userId
    });
  }

  // Create notification for customer
  await createAndEmitNotificationServer({
    recipientId: payment.order.userId,
    title: 'Payment Received',
    message: `Your payment of $${Number(payment.amount).toFixed(2)} for Order #${payment.order.orderNumber} was successful.`,
    type: 'PAYMENT_SUCCEEDED',
    orderId: payment.order.id
  });
}

/**
 * Handles payment_intent.payment_failed event:
 * Sets Payment.status = FAILED, keeps reserved stock held for user order (to be cleared by expiration cron), keeps Order IN_PROGRESS for Pay Again.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const lastError = paymentIntent.last_payment_error;

  const { friendlyMessage, rawErrorCode, rawErrorMessage } = getFriendlyPaymentErrorMessage(lastError);

  logStripeError('handlePaymentIntentFailed:rawError', lastError, {
    paymentIntentId,
    rawErrorCode,
    rawErrorMessage
  });

  const payment = await findAndValidatePaymentForIntent(paymentIntent);

  if (!payment) {
    return;
  }

  // 1. Update Payment record with friendly message and raw code
  if (payment.status !== 'FAILED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        stripePaymentIntentId: paymentIntentId,
        errorMessage: friendlyMessage || 'Payment was unsuccessful or canceled.',
        rawErrorCode: rawErrorCode
      }
    });
  }

  // Stock remains reserved for the user's order (will be handled by future expiration cron job)

  // 2. Create notification for customer
  await createAndEmitNotificationServer({
    recipientId: payment.order.userId,
    title: 'Payment Failed',
    message: `Payment failed for Order #${payment.order.orderNumber}: ${friendlyMessage || 'Payment was declined or canceled.'}`,
    type: 'PAYMENT_FAILED',
    orderId: payment.order.id
  });
}

/**
 * Handles charge.refunded event:
 * Sets Payment.status = REFUNDED or PARTIALLY_REFUNDED, refundedAt = now().
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

  if (!paymentIntentId) return;

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { order: true }
  });

  if (!payment) return;

  const isFullRefund = charge.amount_refunded >= charge.amount;
  const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: newStatus,
      refundedAt: new Date()
    }
  });

  await createAndEmitNotificationServer({
    recipientId: payment.order.userId,
    title: 'Payment Refunded',
    message: `A refund of $${(charge.amount_refunded / 100).toFixed(2)} was processed for Order #${payment.order.orderNumber}.`,
    type: 'PAYMENT_REFUNDED',
    orderId: payment.order.id
  });
}

/**
 * Handles setup_intent.succeeded event:
 * Saves attached card to user's PaymentMethods table when setup completes.
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const userId = setupIntent.metadata?.userId;
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id || null;

  if (!userId || !paymentMethodId) return;

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm.card) return;

    const existing = await prisma.paymentMethod.findUnique({
      where: { stripePaymentMethodId: paymentMethodId }
    });

    if (!existing) {
      const userCardCount = await prisma.paymentMethod.count({
        where: { userId }
      });

      await prisma.paymentMethod.create({
        data: {
          userId,
          stripePaymentMethodId: paymentMethodId,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          isDefault: userCardCount === 0
        }
      });
    }
  } catch (err) {
    logStripeError('handleSetupIntentSucceeded', err, { userId, paymentMethodId });
  }
}

/**
 * Main Stripe Webhook processing service.
 */
export async function processStripeWebhookServer(body: string, signature: string | null) {
  const validation = validateStripeWebhookInput(signature, process.env.STRIPE_WEBHOOK_SECRET);
  if (!validation.success) {
    return {
      success: false as const,
      status: validation.status,
      message: validation.message
    };
  }

  const { signature: validSignature, webhookSecret } = validation.data;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, validSignature, webhookSecret);
  } catch (err: unknown) {
    const error = err as Error;
    logStripeError('stripeWebhook:constructEvent', error);
    return {
      success: false as const,
      status: 400,
      message: `Webhook signature verification failed: ${error.message}`
    };
  }

  // 1. Atomic Claim-First Idempotency (Prevents concurrent duplicate webhook delivery races)
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type
      }
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      return {
        success: true as const,
        status: 200,
        isDuplicate: true,
        message: 'Duplicate event acknowledged'
      };
    }
    logStripeError('stripeWebhook:claimEventError', err as Error, { eventId: event.id });
    return {
      success: false as const,
      status: 500,
      message: 'Webhook idempotency claim failed'
    };
  }

  // 2. Process Specific Events
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentProcessing(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        await handleSetupIntentSucceeded(setupIntent);
        break;
      }

      default: {
        // Unhandled event type acknowledged
        break;
      }
    }

    return {
      success: true as const,
      status: 200,
      message: 'Webhook event processed successfully'
    };
  } catch (error) {
    logStripeError(`stripeWebhook:eventHandler:${event.type}`, error, {
      eventId: event.id
    });

    return {
      success: false as const,
      status: 500,
      message: 'Webhook handler failed to process event'
    };
  }
}
