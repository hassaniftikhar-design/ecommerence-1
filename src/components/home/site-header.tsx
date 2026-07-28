import { Bell, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/common/logo";
import { UserMenu } from "@/components/common/user-menu";
import { ROUTES } from "@/constants/routes";

// TODO(backend-integration): replace with a real session check (e.g.
// NextAuth's `auth()` / `useSession()`) once auth is wired up. Hardcoded
// here for the same reason MOCK_PRODUCTS is hardcoded in constants/ --
// it lets the logged-in UI (UserMenu) be built and reviewed now, with
// exactly one line to change later.
const IS_AUTHENTICATED = true;

// Server Component: the header itself is static markup. The one truly
// interactive piece -- the account dropdown -- is isolated inside
// <UserMenu />, so this component doesn't need "use client" just to
// host it.
export function SiteHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border-card bg-white px-6">
      <Logo />
      <div className="flex items-center gap-6">
        <Link href={ROUTES.cart} aria-label="Shopping bag">
          <ShoppingBag className="h-5 w-5 text-primary" />
        </Link>
        <Bell className="h-5 w-5 text-primary" aria-label="Notifications" />
        {IS_AUTHENTICATED ? (
          <UserMenu />
        ) : (
          <Link
            href={ROUTES.login}
            className="text-sm font-medium text-primary"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
