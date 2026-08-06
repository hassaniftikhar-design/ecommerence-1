"use client";

import { useState } from "react";
import { ChevronDown, User, ShieldCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrdersModal } from "@/components/orders/orders-modal";
import { ROUTES } from "@/constants/routes";
import { logout } from "@/services/auth.service";

export function UserMenu() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-primary outline-none">
          <User className="h-5 w-5" aria-hidden="true" />
          {session?.user?.name && (
            <span className="hidden md:inline-block font-normal text-slate-700 dark:text-slate-400">
              {session.user.name.split(" ")[0]}
            </span>
          )}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Account menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isAdmin && (
            <>
              <DropdownMenuItem asChild>
                <Link href={ROUTES.adminProducts} className="flex items-center gap-2 font-semibold text-primary">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Manage Products
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => setOrdersModalOpen(true)}
            className="flex items-center gap-2 cursor-pointer font-medium"
          >
            <ShoppingBag className="h-4 w-4 text-slate-500" />
            My Orders
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} className="text-red-600 focus:text-red-600">
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Side Orders Modal (1138px x 728px right-side slide-over) */}
      <OrdersModal
        isOpen={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
      />
    </>
  );
}
