"use client";

import { ChevronDown, User } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";

// Composes the generic DropdownMenu primitive into the specific
// "account menu" the Figma shows: Orders, a divider, then Logout.
// Client Component because DropdownMenuTrigger needs a client-side
// event target (Radix requirement) -- it's the same reasoning as
// RememberMe wrapping the Checkbox primitive.
export function UserMenu() {
  const handleLogout = () => {
    // TODO(backend-integration): call auth.service.ts once a logout
    // endpoint / NextAuth signOut() exists. For now this is a
    // placeholder, same as every other submit handler in Phase 1.
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-primary outline-none">
        <User className="h-5 w-5" aria-hidden="true" />
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={ROUTES.orders}>Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
