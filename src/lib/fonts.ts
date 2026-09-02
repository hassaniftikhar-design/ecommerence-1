import { Inter } from 'next/font/google';

// Centralized font loading so next/font only fetches/subsets the font
// once at build time and every layout/page shares the same CSS variable.
// Using next/font (instead of a <link> tag) avoids layout shift and
// self-hosts the font, which is why it's required by the project brief.
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});
