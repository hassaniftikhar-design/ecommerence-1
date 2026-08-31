import { apiSuccess, apiError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/stripe-server";
import { logStripeError } from "@/lib/stripe/errors";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodRecordId } = await params;
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError("Unauthorized: Please log in", [], 401);
    }

    const card = await prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodRecordId,
        userId,
      },
      include: {
        user: { select: { stripeCustomerId: true } },
      },
    });

    if (!card) {
      return apiError("Payment method not found", [], 404);
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
        logStripeError("setDefaultPaymentMethod:stripeCustomerUpdate", stripeErr, {
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

    return apiSuccess("Default payment method updated successfully");
  } catch (error) {
    logStripeError("setDefaultPaymentMethod:PATCH", error);
    return apiError("Failed to update default payment method", [
      (error as Error).message,
    ], 500);
  }
}
