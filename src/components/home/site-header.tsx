"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { UserMenu } from "@/components/common/user-menu";
import { RequireLoginModal } from "@/components/auth/require-login-modal";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { ROUTES } from "@/constants/routes";

export function SiteHeader() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleCartClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
        <Link href={ROUTES.home} className="text-xl font-bold text-gray-900">
          E-commerce
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href={ROUTES.cart} onClick={handleCartClick} aria-label="Shopping bag">
            <ShoppingBag className="h-5 w-5 text-[#007BFF] hover:opacity-80 transition cursor-pointer" />
          </Link>
          <NotificationPopover />
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Link
              href={ROUTES.login}
              className="text-sm font-medium text-[#007BFF]"
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