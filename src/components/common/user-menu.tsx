"use client";

import { ChevronDown, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import { logout } from "@/services/auth.service";

export function UserMenu() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const handleLogout = async () => {
    await logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-primary outline-none">
        <User className="h-5 w-5" aria-hidden="true" />
        {session?.user?.name && (
          <span className="hidden md:inline-block font-normal text-slate-700 dark:text-slate-200">
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
        <DropdownMenuItem asChild>
          <Link href={ROUTES.orders}>Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="text-red-600 focus:text-red-600">
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
