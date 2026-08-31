import { apiSuccess, apiError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/stripe-server";
import { logStripeError } from "@/lib/stripe/errors";

export const dynamic = "force-dynamic";

export async function DELETE(
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

    // 1. Detach from Stripe
    try {
      await stripe.paymentMethods.detach(card.stripePaymentMethodId);
    } catch (stripeErr) {
      logStripeError("deletePaymentMethod:detach", stripeErr, {
        paymentMethodId: card.stripePaymentMethodId,
      });
      // Even if Stripe detach reports an error (e.g. already detached), proceed to delete local record
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
              logStripeError("deletePaymentMethod:reassignDefault", updateErr);
            }
          }
        }
      }
    });

    return apiSuccess("Payment method deleted successfully");
  } catch (error) {
    logStripeError("deletePaymentMethod:DELETE", error);
    return apiError("Failed to delete payment method", [
      (error as Error).message,
    ], 500);
  }
}
