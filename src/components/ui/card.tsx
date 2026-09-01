import * as React from 'react';

import { cn } from '@/lib/utils';

// The Figma auth card is a plain white panel with a 1px light-gray
// border and no drop shadow -- intentionally flat, so we don't add a
// shadow utility here even though shadcn's default Card usually has one.
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded border border-border-card bg-surface-card',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export { Card };
