'use client';

import React, { useState } from 'react';

import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  if (!content) return <>{children}</>;

  return (
    <div
      className="relative inline-block max-w-full"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-[99999] pointer-events-none px-3 py-1.5 text-xs font-medium text-white bg-slate-900/95 backdrop-blur-xs rounded-lg shadow-xl border border-slate-700/50 whitespace-normal max-w-xs break-words leading-relaxed animate-in fade-in zoom-in-95 duration-150',
            side === 'top' && 'bottom-full mb-2 left-1/2 -translate-x-1/2',
            side === 'bottom' && 'top-full mt-2 left-1/2 -translate-x-1/2',
            side === 'left' && 'right-full mr-2 top-1/2 -translate-y-1/2',
            side === 'right' && 'left-full ml-2 top-1/2 -translate-y-1/2',
            className
          )}
        >
          {content}
          {/* Arrow indicator */}
          <div
            className={cn(
              'absolute w-2 h-2 bg-slate-900 rotate-45 border-slate-700/50',
              side === 'top' && '-bottom-1 left-1/2 -translate-x-1/2 border-b border-r',
              side === 'bottom' && '-top-1 left-1/2 -translate-x-1/2 border-t border-l',
              side === 'left' && '-right-1 top-1/2 -translate-y-1/2 border-t border-r',
              side === 'right' && '-left-1 top-1/2 -translate-y-1/2 border-b border-l'
            )}
          />
        </div>
      )}
    </div>
  );
}
