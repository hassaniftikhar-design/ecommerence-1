import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      "";

    if (!publishableKey) {
      console.warn("⚠️ Stripe publishable key is not defined in environment variables.");
    }

    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};
