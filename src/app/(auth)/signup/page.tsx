import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { AuthTitle } from '@/components/auth/auth-title';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new E-commerce account.',
  openGraph: { title: 'Sign Up | E-commerce' }
};

export default function SignupPage() {
  return (
    <>
      <AuthTitle>SignUp</AuthTitle>
      <AuthCard>
        <SignupForm />
      </AuthCard>
    </>
  );
}
