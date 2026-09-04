import { headers } from 'next/headers';

import type Stripe from 'stripe';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/stripe-server';
import { getFriendlyPaymentErrorMessage, logStripeError } from '@/lib/stripe/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured in environment.');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const error = err as Error;
    logStripeError('stripeWebhook:constructEvent', error);
    return new Response(`Webhook signature verification failed: ${error.message}`, {
      status: 400
    });
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
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    logStripeError('stripeWebhook:claimEventError', err as Error, { eventId: event.id });
    return new Response('Webhook idempotency claim failed', { status: 500 });
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

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logStripeError(`stripeWebhook:eventHandler:${event.type}`, error, {
      eventId: event.id
    });

    return new Response('Webhook handler failed to process event', {
      status: 500
    });
  }
}

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
        const existingCard = await prisma.paymentMethod.findUnique({
          where: { stripePaymentMethodId: paymentMethodId }
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

  // Clear user's cart on payment success
  try {
    const userCart = await prisma.cart.findUnique({
      where: { userId: payment.order.userId }
    });
    if (userCart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: userCart.id }
      });
    }
  } catch (cartErr) {
    logStripeError('handlePaymentIntentSucceeded:clearCart', cartErr, {
      userId: payment.order.userId
    });
  }

  // Create notification for customer
  await prisma.notification.create({
    data: {
      userId: payment.order.userId,
      title: 'Payment Received',
      message: `Your payment of $${Number(payment.amount).toFixed(2)} for Order #${payment.order.orderNumber} was successful.`,
      type: 'PAYMENT_SUCCEEDED',
      orderId: payment.order.id
    }
  });
}

/**
 * Handles payment_intent.payment_failed event:
 * Sets Payment.status = FAILED, releases reserved stock, keeps Order IN_PROGRESS for Pay Again.
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

  // 2. Release reserved stock back to product variants so inventory isn't locked
  // Order remains IN_PROGRESS so the user can Pay Again
  if (payment.order && payment.status !== 'FAILED') {
    await prisma.$transaction(async (tx) => {
      for (const item of payment.order.items) {
        let targetVariantId = item.variantId;
        if (!targetVariantId) {
          const firstVariant = await tx.productVariant.findFirst({
            where: { productId: item.productId }
          });
          if (firstVariant) {
            targetVariantId = firstVariant.id;
          }
        }

        if (targetVariantId) {
          await tx.productVariant.update({
            where: { id: targetVariantId },
            data: {
              stock: { increment: item.quantity }
            }
          });
        }
      }
    });
  }

  // 3. Create notification for customer
  await prisma.notification.create({
    data: {
      userId: payment.order.userId,
      title: 'Payment Failed',
      message: `Payment failed for Order #${payment.order.orderNumber}: ${friendlyMessage || 'Payment was declined or canceled.'}`,
      type: 'PAYMENT_FAILED',
      orderId: payment.order.id
    }
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

  await prisma.notification.create({
    data: {
      userId: payment.order.userId,
      title: 'Payment Refunded',
      message: `A refund of $${(charge.amount_refunded / 100).toFixed(2)} was processed for Order #${payment.order.orderNumber}.`,
      type: 'PAYMENT_REFUNDED',
      orderId: payment.order.id
    }
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
