'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useSearchParams } from 'next/navigation';

import { getSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { FormField } from '@/components/forms/form-field';
import { RememberMe } from '@/components/auth/remember-me';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { ROUTES } from '@/constants/routes';
import { isValidEmail } from '@/utils/validation';
import type { LoginPayload } from '@/types/auth.types';
import { login } from '@/services/auth.service';
import { useToast } from '@/components/ui/toast';

export function LoginForm() {
  const searchParams = useSearchParams();
  const oauthErrorParam = searchParams.get('error');
  const registeredParam = searchParams.get('registered');
  const { showSuccess, showError } = useToast();
  const processedParamRef = useRef<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentParamKey = `${registeredParam}-${oauthErrorParam}`;
    if (processedParamRef.current === currentParamKey) return;
    processedParamRef.current = currentParamKey;

    if (registeredParam === 'true') {
      showSuccess('Account created successfully! Please log in with your credentials.', 'Registration Successful');
    }
    if (oauthErrorParam === 'CredentialsSignin') {
      showError('Wrong Email & password, please enter correct credentials', 'Login Failed');
    } else if (oauthErrorParam === 'OAuthSignin' || oauthErrorParam === 'Configuration') {
      showError('Google OAuth Failed, Please try again!', 'Google Login Failed');
    }
  }, [registeredParam, oauthErrorParam, showSuccess, showError]);

  const validateField = (name: 'email' | 'password', val: string): string | undefined => {
    if (name === 'email') {
      if (!val.trim()) return 'Email is required';
      if (!isValidEmail(val)) return 'Enter a valid email address';
    }
    if (name === 'password') {
      if (!val) return 'Password is required';
    }
    return undefined;
  };

  const handleBlur = (name: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const errorMsg = validateField(name, name === 'email' ? email : password);
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    const emailErr = validateField('email', email);
    const passwordErr = validateField('password', password);

    if (emailErr || passwordErr) {
      setErrors({ email: emailErr, password: passwordErr });
      return;
    }

    setErrors({});
    const payload: LoginPayload = { email, password, rememberMe };

    try {
      setLoading(true);
      await login(payload);
      const session = await getSession();
      if (session?.user?.role === 'ADMIN') {
        window.location.href = `${ROUTES.adminProducts}?welcome=true`;
      } else {
        window.location.href = `${ROUTES.home}?welcome=true`;
      }
    } catch (err) {
      const msg = (err as Error).message;
      const displayMsg =
        msg === 'CredentialsSignin' || msg.includes('CredentialsSignin')
          ? 'Wrong Email & password, please enter correct credentials'
          : msg || 'Failed to log in. Please try again.';
      showError(displayMsg, 'Login Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Enter email address"
        name="email"
        type="email"
        placeholder="Please enter your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (touched.email) {
            setErrors((prev) => ({
              ...prev,
              email: validateField('email', e.target.value)
            }));
          }
        }}
        onBlur={() => handleBlur('email')}
        error={errors.email}
        autoComplete="email"
        required
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        placeholder="Please enter password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (touched.password) {
            setErrors((prev) => ({
              ...prev,
              password: validateField('password', e.target.value)
            }));
          }
        }}
        onBlur={() => handleBlur('password')}
        error={errors.password}
        autoComplete="current-password"
        required
      />

      <RememberMe checked={rememberMe} onCheckedChange={setRememberMe} />

      <Button type="submit" className="mb-4 w-full" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </Button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface-card px-2 text-slate-500 font-medium">Or continue with</span>
        </div>
      </div>

      <div className="mb-6">
        <GoogleAuthButton label="Sign in with Google" />
      </div>

      <div className="space-y-2">
        <AuthFooterLink
          promptText="Forgot Password!"
          linkText="Reset"
          href={ROUTES.forgotPassword}
        />
        <AuthFooterLink
          promptText="I don't have an account!"
          linkText="SignUp"
          href={ROUTES.signup}
        />
      </div>
    </form>
  );
}
