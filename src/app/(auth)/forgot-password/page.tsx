import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthTitle } from '@/components/auth/auth-title';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset the password for your E-commerce account.',
  openGraph: { title: 'Forgot Password | E-commerce' }
};

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthTitle>Forgot Password</AuthTitle>
      <AuthCard>
        <ForgotPasswordForm />
      </AuthCard>
    </>
  );
}
