"use client";

import { useEffect, useState } from "react";
import { BackHeading } from "@/components/common/back-heading";
import { CartTable } from "@/components/cart/cart-table";
import { CartSummary } from "@/components/cart/cart-summary";
import {
  getCart,
  updateCartItemQuantity,
  removeCartItem,
} from "@/services/cart.service";
import { ROUTES } from "@/constants/routes";
import type { CartItem, CartTotals } from "@/types/cart.types";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState<CartTotals>({
    subTotal: 0,
    tax: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCartData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCart();
      setItems(data.items);
      setTotals(data.totals);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartData();
  }, []);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    try {
      // Optimistic state update
      const updatedItems = items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: Math.round(item.price * newQuantity * 100) / 100,
            }
          : item
      );
      setItems(updatedItems);

      // Recalculate totals client-side for immediate responsiveness
      const subTotal = updatedItems.reduce((acc, i) => acc + i.totalPrice, 0);
      const roundedSub = Math.round(subTotal * 100) / 100;
      const tax = Math.round(roundedSub * 0.08 * 100) / 100;
      const total = Math.round((roundedSub + tax) * 100) / 100;
      setTotals({ subTotal: roundedSub, tax, total });

      // Call API
      const response = await updateCartItemQuantity(itemId, newQuantity);
      setItems(response.items);
      setTotals(response.totals);
    } catch (err) {
      // Fallback on error
      fetchCartData();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const updatedItems = items.filter((i) => i.id !== itemId);
      setItems(updatedItems);

      const subTotal = updatedItems.reduce((acc, i) => acc + i.totalPrice, 0);
      const roundedSub = Math.round(subTotal * 100) / 100;
      const tax = Math.round(roundedSub * 0.08 * 100) / 100;
      const total = Math.round((roundedSub + tax) * 100) / 100;
      setTotals({ subTotal: roundedSub, tax, total });

      const response = await removeCartItem(itemId);
      setItems(response.items);
      setTotals(response.totals);
    } catch (err) {
      fetchCartData();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <BackHeading title="Your Shopping Bag" href={ROUTES.home} />

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-xs font-semibold text-red-600 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400 font-medium">
          Loading your shopping bag...
        </div>
      ) : (
        <>
          <CartTable
            items={items}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
          />
          <CartSummary
            totals={totals}
            isEmpty={items.length === 0}
            onOrderPlaced={() => {
              setItems([]);
              setTotals({ subTotal: 0, tax: 0, total: 0 });
            }}
          />
        </>
      )}
    </div>
  );
}
