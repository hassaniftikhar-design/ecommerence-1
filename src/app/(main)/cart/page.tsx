import type { Metadata } from "next";

import { BackHeading } from "@/components/common/back-heading";
import { CartTable } from "@/components/cart/cart-table";
import { CartSummary } from "@/components/cart/cart-summary";
import { MOCK_CART_ITEMS, MOCK_CART_TOTALS } from "@/constants/mock-cart";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Your Shopping Bag",
  description: "Review the items in your shopping bag before checkout.",
  openGraph: { title: "Your Shopping Bag | E-commerce" },
};

// Server Component. Reads mock data synchronously today; becomes
// `async` + `await getCart()` once cart.service.ts is real -- CartTable
// and CartSummary don't change either way.
export default function CartPage() {
  const items = MOCK_CART_ITEMS;
  const totals = MOCK_CART_TOTALS;

  return (
    <>
      <BackHeading title="Your Shopping Bag" href={ROUTES.home} />
      <CartTable items={items} />
      <CartSummary totals={totals} />
    </>
  );
}
