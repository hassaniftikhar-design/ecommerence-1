import { apiSuccess, apiError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { stripe, createOrGetStripeCustomer } from "@/lib/stripe/stripe-server";
import { logStripeError } from "@/lib/stripe/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError("Unauthorized: Please log in", [], 401);
    }

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

    return apiSuccess("Payment methods retrieved successfully", {
      paymentMethods: formatted,
    });
  } catch (error) {
    return apiError("Failed to fetch payment methods", [
      (error as Error).message,
    ], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError("Unauthorized: Please log in", [], 401);
    }

    const body = await request.json();
    const { paymentMethodId, setAsDefault } = body;

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return apiError("Missing or invalid paymentMethodId", [], 400);
    }

    // Retrieve card details from Stripe
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm.card) {
      return apiError("The provided payment method is not a card", [], 400);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });

    if (!dbUser) {
      return apiError("User not found", [], 404);
    }

    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      customerId = await createOrGetStripeCustomer({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      });
    }

    // Attach payment method to customer if not attached
    if (customerId && pm.customer !== customerId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    }

    const existingCardsCount = await prisma.paymentMethod.count({
      where: { userId },
    });

    const isFirstCard = existingCardsCount === 0;
    const shouldBeDefault = Boolean(setAsDefault) || isFirstCard;

    if (shouldBeDefault && customerId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      } catch (stripeErr) {
        logStripeError("savePaymentMethod:setDefaultOnStripe", stripeErr, { customerId });
      }
    }

    const savedCard = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.paymentMethod.upsert({
        where: { stripePaymentMethodId: paymentMethodId },
        create: {
          userId,
          stripePaymentMethodId: paymentMethodId,
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

    return apiSuccess("Payment method saved successfully", {
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
    }, 201);
  } catch (error) {
    logStripeError("savePaymentMethod:POST", error);
    return apiError("Failed to save payment method", [
      (error as Error).message,
    ], 500);
  }
}
