'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { FormField } from '@/components/forms/form-field';
import { ROUTES } from '@/constants/routes';
import { isValidEmail } from '@/utils/validation';

import { forgotPassword } from '@/services/auth.service';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (val: string): string | undefined => {
    if (!val.trim()) return 'Email is required';
    if (!isValidEmail(val)) return 'Enter a valid email address';
    return undefined;
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validateEmail(email));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }

    setError(undefined);

    try {
      setLoading(true);
      await forgotPassword({ email });
    } catch {
      // Intentionally suppress toast errors to avoid exposing email presence
      // and display the clean inline security message
    } finally {
      setEmail('');
      setTouched(false);
      setError(undefined);
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Informative Green Notice Box shown upon clicking Forgot Password */}
      {submitted && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 shadow-2xs">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="leading-relaxed font-medium">
            A reset link will be sent if the email exists.
          </p>
        </div>
      )}

      <FormField
        label="Enter email address"
        name="email"
        type="email"
        placeholder="Please enter your email"
        value={email}
        onChange={(e) => {
          if (submitted) {
            setSubmitted(false);
          }
          setEmail(e.target.value);
          if (touched) {
            setError(validateEmail(e.target.value));
          }
        }}
        onBlur={handleBlur}
        error={error}
        autoComplete="email"
        required
      />

      <Button type="submit" className="mb-6 mt-3 w-full" disabled={loading}>
        {loading ? 'Sending...' : 'Forgot Password'}
      </Button>

      <AuthFooterLink
        promptText="No, I remember my password"
        linkText="Login"
        href={ROUTES.login}
      />
    </form>
  );
}
