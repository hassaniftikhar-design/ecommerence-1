'use client';

import { useEffect } from 'react';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { useToast } from '@/components/ui/toast';

export function WelcomeToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { showSuccess } = useToast();

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      showSuccess('Login successful! Welcome back.', 'Welcome Back');

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('welcome');
      const queryString = newParams.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router, showSuccess]);

  return null;
}
