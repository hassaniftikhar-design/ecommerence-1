"use client";

import { Bell, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { UserMenu } from "@/components/common/user-menu";
import { ROUTES } from "@/constants/routes";

export function SiteHeader() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
      <Link href={ROUTES.home} className="text-xl font-bold text-gray-900">
        E-commerce
      </Link>
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href={ROUTES.cart} aria-label="Shopping bag">
          <ShoppingBag className="h-5 w-5 text-[#007BFF]" />
        </Link>
        <Bell className="h-5 w-5 text-[#007BFF]" aria-label="Notifications" />
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
  );
}