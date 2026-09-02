import { Suspense } from 'react';

import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthTitle } from '@/components/auth/auth-title';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Choose a new password for your E-commerce account.',
  openGraph: { title: 'Reset Password | E-commerce' }
};

export default function ResetPasswordPage() {
  return (
    <>
      <AuthTitle>Reset Password</AuthTitle>
      <AuthCard>
        <Suspense fallback={<div className="p-4 text-center text-sm text-slate-500">Loading form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </>
  );
}
