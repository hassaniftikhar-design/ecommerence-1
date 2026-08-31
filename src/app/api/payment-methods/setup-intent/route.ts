import { apiSuccess, apiError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { stripe, createOrGetStripeCustomer } from "@/lib/stripe/stripe-server";
import { logStripeError } from "@/lib/stripe/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError("Unauthorized: Please log in", [], 401);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, stripeCustomerId: true },
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
        phone: dbUser.phone,
      });
    }

    if (!customerId) {
      return apiError("Failed to initialize Stripe customer", [], 500);
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
      return apiError("Failed to create setup intent", [], 500);
    }

    return apiSuccess("Setup intent created successfully", {
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    logStripeError("setupIntent:POST", error);
    return apiError("Failed to initialize payment setup", [
      (error as Error).message,
    ], 500);
  }
}
