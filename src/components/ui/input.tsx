import * as React from 'react';

import { cn } from '@/lib/utils';

// Matches the sampled Figma values exactly:
//   border  #ced4da   placeholder text #6c757d   radius 6px
//   focus state adds the primary-colored ring (not in the static Figma,
//   but required by the brief's accessibility section).
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded border border-border bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-danger',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
