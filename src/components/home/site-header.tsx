import { Bell, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { UserMenu } from "@/components/common/user-menu";
import { ROUTES } from "@/constants/routes";

const IS_AUTHENTICATED = false; // Set to false to show 'Login' based on screenshot

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
      <div className="text-xl font-bold text-gray-900">
        E-commerce
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href={ROUTES.cart} aria-label="Shopping bag">
          <ShoppingBag className="h-5 w-5 text-[#007BFF]" />
        </Link>
        <Bell className="h-5 w-5 text-[#007BFF]" aria-label="Notifications" />
        {IS_AUTHENTICATED ? (
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