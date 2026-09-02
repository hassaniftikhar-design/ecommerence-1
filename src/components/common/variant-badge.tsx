'use client';

import React from 'react';

interface VariantBadgeProps {
  color?: string;
  size?: string;
  className?: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border?: boolean }> = {
  black: { bg: '#0F172A', text: '#FFFFFF' },
  white: { bg: '#FFFFFF', text: '#0F172A', border: true },
  red: { bg: '#EF4444', text: '#FFFFFF' },
  blue: { bg: '#2563EB', text: '#FFFFFF' },
  green: { bg: '#16A34A', text: '#FFFFFF' },
  yellow: { bg: '#FACC15', text: '#0F172A' },
  gray: { bg: '#6B7280', text: '#FFFFFF' },
  grey: { bg: '#6B7280', text: '#FFFFFF' },
  navy: { bg: '#1E293B', text: '#FFFFFF' },
  brown: { bg: '#78350F', text: '#FFFFFF' },
  pink: { bg: '#EC4899', text: '#FFFFFF' },
  purple: { bg: '#9333EA', text: '#FFFFFF' },
  orange: { bg: '#EA580C', text: '#FFFFFF' },
  beige: { bg: '#F5F5DC', text: '#0F172A', border: true }
};

function formatSizeAbbr(sizeStr?: string): string {
  if (!sizeStr) return '';
  const cleaned = sizeStr.trim();
  const lower = cleaned.toLowerCase();
  if (lower === 'small') return 'S';
  if (lower === 'medium') return 'M';
  if (lower === 'large') return 'L';
  if (lower === 'extra large') return 'XL';
  return cleaned;
}

export function VariantBadge({ color, size, className = '' }: VariantBadgeProps) {
  if (!color && !size) {
    return <span className="text-xs text-slate-400 font-medium">-</span>;
  }

  const colorName = color?.trim() || '';
  const colorKey = colorName.toLowerCase();
  const colorConfig = COLOR_MAP[colorKey] || {
    bg: colorKey.startsWith('#') ? colorKey : '#64748B',
    text: '#FFFFFF'
  };

  const sizeAbbr = formatSizeAbbr(size);
  const titleTooltip = [
    colorName ? `Color: ${colorName}` : null,
    size ? `Size: ${size}` : null
  ]
    .filter(Boolean)
    .join(' | ');

  // If size exists, render a circular badge with size text inside
  if (sizeAbbr) {
    return (
      <div
        title={titleTooltip}
        className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-[10px] font-extrabold tracking-tighter shrink-0 shadow-2xs transition-transform hover:scale-105 ${
          colorConfig.border ? 'border border-slate-300' : ''
        } ${className}`}
        style={{
          backgroundColor: colorConfig.bg,
          color: colorConfig.text
        }}
      >
        {sizeAbbr}
      </div>
    );
  }

  // If only color exists without size, render a clean color circle
  return (
    <div
      title={titleTooltip}
      className={`inline-block h-5 w-5 rounded-full shrink-0 shadow-2xs ${
        colorConfig.border ? 'border border-slate-300' : ''
      } ${className}`}
      style={{
        backgroundColor: colorConfig.bg
      }}
    />
  );
}
