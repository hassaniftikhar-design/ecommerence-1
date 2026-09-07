'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { FormField } from '@/components/forms/form-field';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { FacebookAuthButton } from '@/components/auth/facebook-auth-button';
import { ROUTES } from '@/constants/routes';
import { isValidEmail, isStrongPassword } from '@/utils/validation';
import type { SignupPayload } from '@/types/auth.types';
import { signup } from '@/services/auth.service';
import { useToast } from '@/components/ui/toast';

export function SignupForm() {
  const router = useRouter();
  const { showError } = useToast();

  const [formData, setFormData] = useState<SignupPayload>({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupPayload, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SignupPayload, boolean>>>({});
  const [loading, setLoading] = useState(false);

  const validateField = (name: keyof SignupPayload, value: string | undefined, currentData = formData): string | undefined => {
    const val = (value || '').trim();
    switch (name) {
      case 'fullName':
        if (!val) return 'Full name is required';
        if (val.length < 2) return 'Enter your full name';
        return undefined;

      case 'email':
        if (!val) return 'Email is required';
        if (!isValidEmail(val)) return 'Enter a valid email address';
        return undefined;

      case 'mobile':
        if (val && (!/^[+0-9\s-]+$/.test(val) || val.replace(/\D/g, '').length < 10)) {
          return 'Enter a valid phone number (at least 10 digits)';
        }
        return undefined;

      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!isStrongPassword(value)) {
          return 'Password must contain uppercase, lowercase, number and symbols';
        }
        return undefined;

      case 'confirmPassword':
        if (!value) return 'Confirm password is required';
        if (value !== currentData.password) return 'Passwords must match';
        return undefined;

      default:
        return undefined;
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const fieldName = name as keyof SignupPayload;
    const updatedData = { ...formData, [fieldName]: value };
    setFormData(updatedData);

    if (touched[fieldName]) {
      setErrors((prev) => ({
        ...prev,
        [fieldName]: validateField(fieldName, value, updatedData)
      }));
    }

    if (fieldName === 'password' && touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateField('confirmPassword', formData.confirmPassword, updatedData)
      }));
    }
  };

  const handleBlur = (fieldName: keyof SignupPayload) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    setErrors((prev) => ({
      ...prev,
      [fieldName]: validateField(fieldName, formData[fieldName], formData)
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const allTouched: Partial<Record<keyof SignupPayload, boolean>> = {
      fullName: true,
      email: true,
      mobile: true,
      password: true,
      confirmPassword: true
    };
    setTouched(allTouched);

    const validationErrors: Partial<Record<keyof SignupPayload, string>> = {
      fullName: validateField('fullName', formData.fullName, formData),
      email: validateField('email', formData.email, formData),
      mobile: validateField('mobile', formData.mobile, formData),
      password: validateField('password', formData.password, formData),
      confirmPassword: validateField('confirmPassword', formData.confirmPassword, formData)
    };

    const hasErrors = Object.values(validationErrors).some(Boolean);
    if (hasErrors) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    try {
      setLoading(true);
      await signup(formData);
      router.push('/login?registered=true');
    } catch (err) {
      const msg = (err as Error).message;
      const displayMsg =
        msg === 'CredentialsSignin' || msg.includes('CredentialsSignin')
          ? 'Wrong credentials, please try again'
          : msg || 'Failed to create account. Please check your details.';
      showError(displayMsg, 'Registration Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Fullname"
        name="fullName"
        placeholder="Fullname"
        value={formData.fullName}
        onChange={handleChange}
        onBlur={() => handleBlur('fullName')}
        error={errors.fullName}
        autoComplete="name"
        required
      />
      <FormField
        label="Email address"
        name="email"
        type="email"
        placeholder="email address"
        value={formData.email}
        onChange={handleChange}
        onBlur={() => handleBlur('email')}
        error={errors.email}
        autoComplete="email"
        required
      />
      <FormField
        label="Mobile"
        name="mobile"
        type="tel"
        placeholder="mobile number"
        value={formData.mobile}
        onChange={handleChange}
        onBlur={() => handleBlur('mobile')}
        error={errors.mobile}
        autoComplete="tel"
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        onBlur={() => handleBlur('password')}
        error={errors.password}
        autoComplete="new-password"
        required
      />
      <FormField
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        placeholder="Password"
        value={formData.confirmPassword}
        onChange={handleChange}
        onBlur={() => handleBlur('confirmPassword')}
        error={errors.confirmPassword}
        autoComplete="new-password"
        required
      />

      <Button type="submit" className="mb-4 mt-2 w-full" disabled={loading}>
        {loading ? 'Creating Account...' : 'SignUp'}
      </Button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface-card px-2 text-slate-500 font-medium">Or continue with</span>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <GoogleAuthButton label="Sign up with Google" />
        <FacebookAuthButton label="Sign up with Facebook" />
      </div>

      <AuthFooterLink
        promptText="Already have an account!"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
