'use client';

import { useEffect, useState, useCallback } from 'react';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { useSession } from 'next-auth/react';
import { AlertCircle, ArrowLeft } from 'lucide-react';

import { CartSkeleton } from '@/components/cart/cart-skeleton';
import { CartTable } from '@/components/cart/cart-table';
import { CartSummary } from '@/components/cart/cart-summary';
import { RequireLoginModal } from '@/components/auth/require-login-modal';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  getCart,
  updateCartItemQuantity,
  removeCartItem,
  removeMultipleCartItems
} from '@/services/cart.service';
import { ROUTES } from '@/constants/routes';
import { TAX_RATE } from '@/constants/generalconstants';
import type { CartItem, CartTotals } from '@/types/cart.types';

import { OrderSuccessModal } from '@/components/orders/order-success-modal';
import { OutOfStockModal } from '@/components/cart/out-of-stock-modal';

const computeTotals = (itemList: CartItem[], selectedIds: string[]): CartTotals => {
  const selectedItems = itemList.filter((item) => selectedIds.includes(item.id));
  const subTotal = selectedItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const roundedSub = Math.round(subTotal * 100) / 100;
  const tax = Math.round(roundedSub * TAX_RATE * 100) / 100;
  const total = Math.round((roundedSub + tax) * 100) / 100;
  return { subTotal: roundedSub, tax, total };
};

export default function CartPage() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const isUnauthenticated = status === 'unauthenticated';

  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [totals, setTotals] = useState<CartTotals>({
    subTotal: 0,
    tax: 0,
    total: 0
  });
  const [placedOrderInfo, setPlacedOrderInfo] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);
  const [outOfStockMessage, setOutOfStockMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingStock, setCheckingStock] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCartData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getCart();
      setItems(data.items);
      const allIds = data.items.map((i) => i.id);
      setSelectedItemIds(allIds);
      setTotals(computeTotals(data.items, allIds));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleProceedToCheckout = async () => {
    if (selectedItemIds.length === 0) return;
    try {
      setCheckingStock(true);
      setError(null);

      // Re-fetch fresh cart state to verify live inventory
      const freshCart = await getCart();
      setItems(freshCart.items);
      setTotals(computeTotals(freshCart.items, selectedItemIds));

      // Find if any selected item is out of stock or exceeds stock
      const outOfStockItem = freshCart.items.find((item) => {
        const available = item.stock ?? 0;
        return selectedItemIds.includes(item.id) && (available === 0 || item.quantity > available);
      });

      if (outOfStockItem) {
        const available = outOfStockItem.stock ?? 0;
        let msg = `Order can't be placed because '${outOfStockItem.name}' is currently out of stock. Please update your cart quantity.`;
        if (available > 0) {
          msg = `Order can't be placed because only ${available} unit(s) of '${outOfStockItem.name}' remain in stock (you requested ${outOfStockItem.quantity}). Please update your cart quantity.`;
        }
        setOutOfStockMessage(msg);
        return;
      }

      // Live stock verified, proceed to checkout
      router.push(ROUTES.checkout);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to verify product stock. Please try again.');
    } finally {
      setCheckingStock(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCartData();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchCartData]);

  const handleSelectionChange = (newSelectedIds: string[]) => {
    setSelectedItemIds(newSelectedIds);
    setTotals(computeTotals(items, newSelectedIds));
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    try {
      // Optimistic state update
      const updatedItems = items.map((item) =>
        item.id === itemId
          ? {
            ...item,
            quantity: newQuantity,
            totalPrice: Math.round(item.price * newQuantity * 100) / 100
          }
          : item
      );
      setItems(updatedItems);
      setTotals(computeTotals(updatedItems, selectedItemIds));

      // Call API
      const response = await updateCartItemQuantity(itemId, newQuantity);
      setItems(response.items);
      setTotals(computeTotals(response.items, selectedItemIds));
    } catch {
      // Fallback on error
      fetchCartData();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const updatedItems = items.filter((i) => i.id !== itemId);
      const updatedSelected = selectedItemIds.filter((id) => id !== itemId);
      setItems(updatedItems);
      setSelectedItemIds(updatedSelected);
      setTotals(computeTotals(updatedItems, updatedSelected));

      const response = await removeCartItem(itemId);
      setItems(response.items);
      const newSelected = updatedSelected.filter((id) => response.items.some((i) => i.id === id));
      setSelectedItemIds(newSelected);
      setTotals(computeTotals(response.items, newSelected));
    } catch {
      fetchCartData();
    }
  };

  const handleRemoveSelectedItems = async () => {
    if (selectedItemIds.length === 0) return;
    try {
      setDeletingBulk(true);
      const updatedItems = items.filter((i) => !selectedItemIds.includes(i.id));
      setItems(updatedItems);
      setSelectedItemIds([]);
      setTotals(computeTotals(updatedItems, []));

      const response = await removeMultipleCartItems(selectedItemIds);
      setItems(response.items);
      setSelectedItemIds([]);
      setTotals(computeTotals(response.items, []));
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to remove selected items');
      fetchCartData();
    } finally {
      setDeletingBulk(false);
    }
  };

  return (
    <div className="space-y-6 mx-auto px-2 sm:px-4 md:px-[56px] lg:px-[60px] pb-12">
      {/* Top Header Row with Title & Delete Selected Button */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <Link
          href={ROUTES.home}
          className="inline-flex items-center gap-2 text-lg sm:text-xl font-bold text-[#007BFF] hover:opacity-80 transition cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          Your Shopping Bag
        </Link>

        {items.length > 0 && selectedItemIds.length > 0 && (
          <ConfirmDialog
            trigger={
              <button
                type="button"
                disabled={deletingBulk}
                className="border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 font-medium px-4 py-2 text-xs sm:text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {deletingBulk
                  ? 'Deleting...'
                  : `Delete Items (${selectedItemIds.length})`}
              </button>
            }
            title="Remove Selected Items"
            description={`Are you sure you want to delete ${selectedItemIds.length} item(s) from your shopping bag?`}
            onConfirm={handleRemoveSelectedItems}
          />
        )}
      </div>

      {/* Expiration/Reservation Note */}
      {items.length > 0 && (
        <p className="text-xs text-slate-500 -mt-2">
          Items in your cart are reserved. The earliest item will expire in{' '}
          <span className="font-semibold text-slate-700">0h 59m 36s</span>
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="flex-1 leading-snug">{error}</span>
        </div>
      )}

      {loading ? (
        <CartSkeleton />
      ) : (
        <>
          <CartTable
            items={items}
            selectedIds={selectedItemIds}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onSelectionChange={handleSelectionChange}
          />
          {items.length > 0 && (
            <CartSummary
              totals={totals}
              isEmpty={items.length === 0}
              selectedItemIds={selectedItemIds}
              onProceedToCheckout={handleProceedToCheckout}
              loading={checkingStock}
            />
          )}
        </>
      )}

      {outOfStockMessage && (
        <OutOfStockModal
          isOpen={true}
          message={outOfStockMessage}
          onClose={() => setOutOfStockMessage(null)}
        />
      )}

      {placedOrderInfo && (
        <OrderSuccessModal
          isOpen={true}
          orderId={placedOrderInfo.orderId}
          orderNumber={placedOrderInfo.orderNumber}
          onContinueShopping={() => {
            setPlacedOrderInfo(null);
            router.push(ROUTES.home);
          }}
          onViewOrderDetails={() => {
            const targetId = placedOrderInfo.orderId;
            setPlacedOrderInfo(null);
            router.push(ROUTES.orderDetail(targetId));
          }}
        />
      )}

      <RequireLoginModal
        isOpen={isUnauthenticated}
        onClose={() => router.push(ROUTES.home)}
        title="Login Required"
        description="Please log in to your account to access and view your shopping cart."
      />
    </div>
  );
}
