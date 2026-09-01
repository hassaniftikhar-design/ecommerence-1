'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo
} from 'react';

import { useSession } from 'next-auth/react';

import { getCart } from '@/services/cart.service';
import type { CartItem } from '@/types/cart.types';
import { isSessionExpired } from '@/constants/auth';

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  getCartQuantity: (productId: string, variantId?: string | null) => number;
  getCartQuantityForProduct: (productId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function getCachedCart(userId?: string): CartItem[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(`shop_cart_cache_${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items)) {
      return parsed.items;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore corrupt cache
  }
  return [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const isExpired = isSessionExpired(session?.user?.sessionExpiresAt);
  const isAuthenticated = status === 'authenticated' && !isExpired;
  const userId = session?.user?.id;

  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setItems([]);
      return;
    }
    try {
      setIsLoading(true);
      const data = await getCart();
      const freshItems = data.items || [];
      setItems(freshItems);

      // Persist to user-scoped localStorage for 0ms instant load on refresh
      try {
        localStorage.setItem(
          `shop_cart_cache_${userId}`,
          JSON.stringify({ items: freshItems, updatedAt: Date.now() })
        );
      } catch {
        // Ignore localStorage quota errors
      }
    } catch {
      // Background fetch error - retain cached state
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (status === 'unauthenticated' || isExpired) {
        setItems([]);
      }
      return;
    }

    // 1. Instant Cache Hydration: Load cached items immediately to eliminate stock decrement delay
    const cached = getCachedCart(userId);
    if (cached.length > 0) {
      setItems(cached);
    }

    // 2. SWR Background Revalidation: Fetch latest cart data from server
    refreshCart();

    const handleCartUpdate = () => {
      refreshCart();
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, [isAuthenticated, userId, status, isExpired, refreshCart]);

  // Highly optimized O(1) quantity lookup map constructed once whenever cart items change
  const quantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      // Variant-specific key
      const vKey = `${item.productId}:${item.variantId || 'default'}`;
      map.set(vKey, (map.get(vKey) || 0) + item.quantity);

      // Product-level key (sum of all variants for this product)
      const pKey = `prod:${item.productId}`;
      map.set(pKey, (map.get(pKey) || 0) + item.quantity);
    }
    return map;
  }, [items]);

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getCartQuantity = useCallback(
    (productId: string, variantId?: string | null): number => {
      if (!productId) return 0;
      const vKey = `${productId}:${variantId || 'default'}`;
      return quantityMap.get(vKey) || 0;
    },
    [quantityMap]
  );

  const getCartQuantityForProduct = useCallback(
    (productId: string): number => {
      if (!productId) return 0;
      const pKey = `prod:${productId}`;
      return quantityMap.get(pKey) || 0;
    },
    [quantityMap]
  );

  const contextValue = useMemo(
    () => ({
      items,
      cartCount,
      isLoading,
      refreshCart,
      getCartQuantity,
      getCartQuantityForProduct
    }),
    [items, cartCount, isLoading, refreshCart, getCartQuantity, getCartQuantityForProduct]
  );

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
