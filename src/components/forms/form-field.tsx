import * as React from 'react';

import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, id, className, type = 'text', ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputId = id ?? props.name;
    const errorId = error ? `${inputId}-error` : undefined;
    const isPasswordType = type === 'password';

    return (
      <div className={cn('mb-5', className)}>
        <Label htmlFor={inputId}>
          {label}
          {props.required && (
            <span className="text-danger font-semibold ml-1" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        <div className="relative">
          <Input
            id={inputId}
            ref={ref}
            type={isPasswordType ? (showPassword ? 'text' : 'password') : type}
            aria-invalid={!!error}
            aria-describedby={errorId}
            className={cn(
              isPasswordType && 'pr-10',
              error && 'border-danger focus-visible:ring-danger',
              className
            )}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';
