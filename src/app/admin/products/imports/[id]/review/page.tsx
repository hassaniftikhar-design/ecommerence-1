'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function ImportReviewRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`${ROUTES.adminProducts}?status=errors`);
  }, [router]);

  return (
    <div className="py-24 text-center text-slate-500 font-medium">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#007BFF] border-t-transparent mb-3" />
      <p className="text-sm">Redirecting to product listing errors...</p>
    </div>
  );
}
