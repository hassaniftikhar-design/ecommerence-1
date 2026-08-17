"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { UserMenu } from "@/components/common/user-menu";
import { RequireLoginModal } from "@/components/auth/require-login-modal";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { ROUTES } from "@/constants/routes";
import { getCart } from "@/services/cart.service";

export function SiteHeader() {
  const { status } = useSession();

  const isAuthenticated = status === "authenticated";
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);

  const fetchCartCount = useCallback(async () => {
    if (!isAuthenticated) {
      setCartCount(0);
      return;
    }
    try {
      const cartData = await getCart();
      const totalCount = (cartData.items || []).reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalCount);
    } catch {
      // Ignore background fetch errors
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCartCount();

    const handleCartUpdate = () => {
      fetchCartCount();
    };

    window.addEventListener("cart-updated", handleCartUpdate);
    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
    };
  }, [fetchCartCount]);

  const handleCartClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 shadow-xs transition-all duration-200">
        <Link href={ROUTES.home} className="text-xl font-bold text-gray-900 hover:text-[#007BFF] transition-colors">
          ShopFastStore
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href={ROUTES.cart} onClick={handleCartClick} aria-label="Shopping bag" className="relative flex items-center justify-center p-1 group">
            <ShoppingBag className="h-5 w-5 text-[#007BFF] group-hover:opacity-80 transition cursor-pointer" />
            {isAuthenticated && cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50 duration-200">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          <NotificationPopover />
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Link
              href={ROUTES.login}
              className="text-sm font-medium text-[#007BFF] hover:underline"
            >
              Login
            </Link>
          )}
        </div>
      </header>

      <RequireLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Login Required"
        description="Please log in to your account to view your shopping cart."
      />
    </>
  );
}