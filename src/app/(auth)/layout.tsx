import type { ReactNode } from 'react';

import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';

export default async function AuthLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();

  if (session) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-[576px]">{children}</div>
    </div>
  );
}
