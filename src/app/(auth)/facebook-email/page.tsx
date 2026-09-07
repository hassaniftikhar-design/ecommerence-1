import { Suspense } from 'react';

import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthTitle } from '@/components/auth/auth-title';
import { FacebookEmailForm } from '@/components/auth/facebook-email-form';

export const metadata: Metadata = {
  title: 'Verify Facebook Email',
  description: 'Link your email address to your Facebook account.',
  openGraph: { title: 'Verify Facebook Email | E-commerce' }
};

export default function FacebookEmailPage() {
  return (
    <>
      <AuthTitle>Link Email</AuthTitle>
      <AuthCard>
        <Suspense fallback={<div className="p-4 text-center text-sm text-slate-500">Loading...</div>}>
          <FacebookEmailForm />
        </Suspense>
      </AuthCard>
    </>
  );
}
