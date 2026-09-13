import * as React from 'react';

import Image from 'next/image';

import Link from 'next/link';

import { ROUTES } from '@/constants/routes';

export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col items-center justify-center gap-3">
      <Link href={ROUTES.home} className="flex items-center gap-2 hover:opacity-90 transition">
        <Image
          src="/FastShopStore.png"
          alt="ShopFastStore Logo"
          width={48}
          height={48}
          className="rounded-xl object-contain shadow-xs"
          priority
        />
      </Link>
      <h1 className="text-center text-3xl sm:text-4xl font-semibold text-primary">
        {children}
      </h1>
    </div>
  );
}

