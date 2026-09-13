import Image from 'next/image';
import Link from 'next/link';

import { ROUTES } from '@/constants/routes';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
  href?: string;
  textClassName?: string;
}

export function Logo({
  className = '',
  showText = true,
  size = 32,
  href = ROUTES.home,
  textClassName = 'text-xl font-bold tracking-tight text-gray-900 hover:text-[#007BFF] transition-colors'
}: LogoProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 transition-opacity hover:opacity-95 ${className}`}
    >
      <div className="relative overflow-hidden rounded-md flex items-center justify-center shrink-0">
        <Image
          src="/FastShopStore.png"
          alt="ShopFastStore Logo"
          width={size}
          height={size}
          className="object-contain rounded-md"
          priority
        />
      </div>
      {showText && (
        <span className={textClassName}>
          ShopFastStore
        </span>
      )}
    </Link>
  );
}

