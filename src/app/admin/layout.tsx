'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSession } from 'next-auth/react';
import { LayoutGrid, Package, LogOut, Menu, X, User, ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/common/logo';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { ROUTES } from '@/constants/routes';
import { logout } from '@/services/auth.service';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isProductsActive = pathname.startsWith('/admin/products');
  const isOrdersActive = pathname.startsWith('/admin/orders');

  const userName = session?.user?.name || 'Admin User';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans w-full">
      {/* Mobile Header Toggle */}
      <div className="flex lg:hidden items-center justify-between border-b border-slate-100 bg-white p-4 shrink-0">
        <Logo href={ROUTES.adminProducts} size={28} textClassName="text-xl font-bold text-slate-900" />
        <div className="flex items-center gap-3">
          {/* Notification Bell for Mobile */}
          <NotificationPopover adminOnly />

          {/* User Icon Dropdown for Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs font-semibold text-[#007BFF] outline-none">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] border border-blue-100">
                <User className="h-4 w-4" />
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="cursor-default text-xs font-semibold !text-black data-[disabled]:!text-black data-[disabled]:opacity-100"
              >
                {userName}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer font-medium flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Admin Sidebar Navigation (Sticky top-0 h-screen) */}
      <aside
        className={`${mobileMenuOpen ? 'block' : 'hidden'
          } lg:flex w-full lg:w-64 border-r border-slate-100 bg-white p-6 flex-col justify-between shrink-0 lg:sticky lg:top-0 lg:h-screen overflow-y-auto`}
      >
        <div>
          <div className="hidden lg:block mb-8">
            <Logo href={ROUTES.adminProducts} size={32} textClassName="text-xl font-bold text-slate-900" />
          </div>

          <nav className="space-y-3">
            <Link
              href={ROUTES.adminProducts}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isProductsActive
                ? 'bg-[#007BFF] text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
            >
              <LayoutGrid className="h-5 w-5" />
              Products
            </Link>

            <Link
              href={ROUTES.adminOrders}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isOrdersActive
                ? 'bg-[#007BFF] text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
            >
              <Package className="h-5 w-5" />
              Orders
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white min-h-screen lg:min-h-0">
        {/* Desktop Top Header Bar with Notification Bell & User Icon Dropdown */}
        <header className="hidden lg:flex h-16 items-center justify-end border-b border-slate-100 bg-white px-8 shrink-0 gap-4">
          <NotificationPopover adminOnly />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-semibold text-[#007BFF] outline-none cursor-pointer hover:opacity-90 transition">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#007BFF] border border-blue-100">
                <User className="h-4 w-4" />
              </div>
              <span>{userName}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs font-semibold text-slate-500 disabled cursor-default">
                {session?.user?.email || 'Admin Account'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer font-medium flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Body Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
