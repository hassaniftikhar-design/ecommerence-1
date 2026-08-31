import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/stripe-server";
import { getFriendlyPaymentErrorMessage, logStripeError } from "@/lib/stripe/errors";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured in environment.");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    logStripeError("stripeWebhook:constructEvent", err);
    return new Response(`Webhook signature verification failed: ${err.message}`, {
      status: 400,
    });
  }

  // 1. Idempotency Check
  const existingEvent = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });

  if (existingEvent) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Process Specific Events
  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      case "setup_intent.succeeded": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        await handleSetupIntentSucceeded(setupIntent);
        break;
      }

      default: {
        // Unhandled event type acknowledged
        break;
      }
    }

    // 3. Record event in StripeWebhookEvent for idempotency
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
      },
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logStripeError(`stripeWebhook:eventHandler:${event.type}`, error, {
      eventId: event.id,
    });

    return new Response("Webhook handler failed to process event", {
      status: 500,
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
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id || null;

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { order: true },
  });

  if (!payment) {
    logStripeError("handlePaymentIntentSucceeded:paymentNotFound", new Error("Payment record not found for PaymentIntent"), {
      paymentIntentId,
      metadata: paymentIntent.metadata,
    });
    return;
  }

  // Update Payment record
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      paidAt: new Date(),
      stripePaymentMethodId: paymentMethodId,
      errorMessage: null,
      rawErrorCode: null,
    },
  });

  // If user opted to save card for future purchases
  const userId = paymentIntent.metadata?.userId || payment.order.userId;
  const saveCard = paymentIntent.metadata?.saveCardForFuture === "true";

  if (saveCard && paymentMethodId && userId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.card) {
        const existingCard = await prisma.paymentMethod.findUnique({
          where: { stripePaymentMethodId: paymentMethodId },
        });

        if (!existingCard) {
          const userCardCount = await prisma.paymentMethod.count({
            where: { userId },
          });

          await prisma.paymentMethod.create({
            data: {
              userId,
              stripePaymentMethodId: paymentMethodId,
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              isDefault: userCardCount === 0, // Make default if it's the user's first saved card
            },
          });
        }
      }
    } catch (saveErr) {
      logStripeError("handlePaymentIntentSucceeded:savePaymentMethod", saveErr, {
        userId,
        paymentMethodId,
      });
    }
  }

  // Clear user's cart on payment success
  try {
    const userCart = await prisma.cart.findUnique({
      where: { userId: payment.order.userId },
    });
    if (userCart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: userCart.id },
      });
    }
  } catch (cartErr) {
    logStripeError("handlePaymentIntentSucceeded:clearCart", cartErr, {
      userId: payment.order.userId,
    });
  }

  // Create notification for customer
  await prisma.notification.create({
    data: {
      userId: payment.order.userId,
      title: "Payment Received",
      message: `Your payment of $${Number(payment.amount).toFixed(2)} for Order #${payment.order.orderNumber} was successful.`,
      type: "PAYMENT_SUCCEEDED",
      orderId: payment.order.id,
    },
  });
}

/**
 * Handles payment_intent.payment_failed event:
 * Sets Payment.status = FAILED, maps decline code to friendly error, and records raw error code.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const lastError = paymentIntent.last_payment_error;

  const { friendlyMessage, rawErrorCode, rawErrorMessage } = getFriendlyPaymentErrorMessage(lastError);

  // Log raw technical error details server-side
  logStripeError("handlePaymentIntentFailed:rawError", lastError, {
    paymentIntentId,
    rawErrorCode,
    rawErrorMessage,
  });

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!payment) {
    return;
  }

  // 1. Update Payment record with friendly message and raw code
  if (payment.status !== "FAILED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        errorMessage: friendlyMessage || "Payment was unsuccessful or canceled.",
        rawErrorCode: rawErrorCode,
      },
    });
  }

  // 2. Release reserved stock if order hasn't already been rejected/refunded
  if (payment.order && payment.order.status !== "REJECTED") {
    await prisma.$transaction(async (tx) => {
      // Mark order as REJECTED
      await tx.order.update({
        where: { id: payment.order.id },
        data: { status: "REJECTED" },
      });

      // Release reserved stock back to product variants
      for (const item of payment.order.items) {
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
          await tx.productVariant.update({
            where: { id: targetVariantId },
            data: {
              stock: { increment: item.quantity },
            },
          });
        }
      }
    });
  }

  // 3. Create notification for customer (cart remains intact)
  await prisma.notification.create({
    data: {
      userId: payment.order.userId,
      title: "Payment Failed",
      message: `Payment failed for Order #${payment.order.orderNumber}: ${friendlyMessage || "Payment was declined or canceled."}`,
      type: "PAYMENT_FAILED",
      orderId: payment.order.id,
    },
  });
}

/**
 * Handles charge.refunded event:
 * Sets Payment.status = REFUNDED or PARTIALLY_REFUNDED, refundedAt = now().
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;

  if (!paymentIntentId) return;

  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { order: true },
  });

  if (!payment) return;

  const isFullRefund = charge.amount_refunded >= charge.amount;
  const newStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: newStatus,
      refundedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: payment.order.userId,
      title: "Payment Refunded",
      message: `A refund of $${(charge.amount_refunded / 100).toFixed(2)} was processed for Order #${payment.order.orderNumber}.`,
      type: "PAYMENT_REFUNDED",
      orderId: payment.order.id,
    },
  });
}

/**
 * Handles setup_intent.succeeded event:
 * Saves attached card to user's PaymentMethods table when setup completes.
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const userId = setupIntent.metadata?.userId;
  const paymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id || null;

  if (!userId || !paymentMethodId) return;

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm.card) return;

    const existing = await prisma.paymentMethod.findUnique({
      where: { stripePaymentMethodId: paymentMethodId },
    });

    if (!existing) {
      const userCardCount = await prisma.paymentMethod.count({
        where: { userId },
      });

      await prisma.paymentMethod.create({
        data: {
          userId,
          stripePaymentMethodId: paymentMethodId,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          isDefault: userCardCount === 0,
        },
      });
    }
  } catch (err) {
    logStripeError("handleSetupIntentSucceeded", err, { userId, paymentMethodId });
  }
}
