import * as React from 'react';

import { cn } from '@/lib/utils';

// Figma label text: #212529, ~14-16px, sits directly above its input
// with a small gap. Plain semantic <label> (not Radix) is enough here
// since there's no compound widget behavior to coordinate.
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('mb-2 block text-sm font-normal text-ink', className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
