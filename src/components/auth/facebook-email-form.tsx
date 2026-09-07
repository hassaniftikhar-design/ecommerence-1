'use client';

import { useState, useEffect, type FormEvent } from 'react';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

import { signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/forms/form-field';
import { useToast } from '@/components/ui/toast';
import { isValidEmail } from '@/utils/validation';
import { ROUTES } from '@/constants/routes';

export function FacebookEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const pendingToken = searchParams.get('pendingToken');

  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!pendingToken) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
          <p className="font-medium">Missing Facebook Session</p>
          <p className="mt-1">
            No active Facebook verification session found. Please sign in with Facebook again.
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={() => router.push(ROUTES.login)}
        >
          Return to Login
        </Button>
      </div>
    );
  }

  const handleSendOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setEmailError(undefined);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email address is required');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/facebook/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, email: trimmed })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(data.message || 'Failed to send verification code', 'Verification Error');
        setLoading(false);
        return;
      }

      showSuccess('Verification code sent to your email', 'Code Sent');
      setStep('OTP');
      setCountdown(60);
    } catch {
      showError('Network error. Please try again.', 'Connection Error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setOtpError(undefined);

    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setOtpError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/facebook/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken,
          email: email.trim(),
          otp: trimmedOtp
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(data.message || 'Invalid or expired code', 'Verification Failed');
        setLoading(false);
        return;
      }

      showSuccess('Email verified! Logging you in...', 'Success');

      // Seamlessly sign in now that account is linked
      await signIn('facebook', { callbackUrl: '/?welcome=true' });
    } catch {
      showError('Network error. Please try again.', 'Connection Error');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-slate-600">
          {step === 'EMAIL'
            ? 'Facebook did not share your email address. Please provide your email to link your account.'
            : `Enter the 6-digit code sent to ${email}.`}
        </p>
      </div>

      {step === 'EMAIL' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <FormField
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(undefined);
            }}
            error={emailError}
            required
            autoFocus
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending Code...' : 'Send Verification Code'}
          </Button>

          <div className="pt-2 text-center text-sm">
            <Link
              href={ROUTES.login}
              className="text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancel and Return to Login
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <FormField
            label="6-Digit Verification Code"
            type="text"
            placeholder="123456"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setOtp(val);
              setOtpError(undefined);
            }}
            error={otpError}
            required
            autoFocus
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify & Link Account'}
          </Button>

          <div className="flex items-center justify-between pt-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('EMAIL');
                setOtp('');
              }}
              className="text-primary hover:underline"
              disabled={loading}
            >
              Change Email
            </button>

            <button
              type="button"
              onClick={() => handleSendOtp()}
              className="text-primary hover:underline disabled:text-slate-400 disabled:no-underline"
              disabled={countdown > 0 || loading}
            >
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
