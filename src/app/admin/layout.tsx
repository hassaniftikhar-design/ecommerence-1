"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutGrid, Package, LogOut, Menu, X } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { logout } from "@/services/auth.service";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isProductsActive = pathname.startsWith("/admin/products");
  const isOrdersActive = pathname.startsWith("/admin/orders");

  const userName = session?.user?.name || " User Name";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans w-full">
      {/* Mobile Header Toggle */}
      <div className="flex lg:hidden items-center justify-between border-b border-slate-100 bg-white p-4 shrink-0">
        <Link href={ROUTES.adminProducts} className="text-xl font-bold text-slate-900">
          E-commerce
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-blue-600">{userName}</span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Admin Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } lg:flex w-full lg:w-64 border-r border-slate-100 bg-white p-6 flex-col justify-between shrink-0 min-h-screen lg:min-h-0`}
      >
        <div>
          <div className="hidden lg:block mb-8">
            <Link href={ROUTES.adminProducts} className="text-xl font-bold text-slate-900">
              E-commerce
            </Link>
          </div>

          <nav className="space-y-3">
            <Link
              href={ROUTES.adminProducts}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isProductsActive
                  ? "bg-[#007BFF] text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <LayoutGrid className="h-5 w-5" />
              Products
            </Link>

            <Link
              href={ROUTES.adminOrders}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isOrdersActive
                  ? "bg-[#007BFF] text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Package className="h-5 w-5" />
              Orders
            </Link>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-100 mt-6 lg:mt-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-700 transition"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white min-h-screen lg:min-h-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex h-16 items-center justify-end border-b border-slate-100 bg-white px-8 shrink-0">
          <span className="text-sm font-semibold text-[#007BFF]">{userName}</span>
        </header>

        {/* Page Body Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
