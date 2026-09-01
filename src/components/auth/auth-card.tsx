import * as React from 'react';

import { Card } from '@/components/ui/card';

// Every auth screen in the Figma is: centered page, big blue heading
// above, a fixed-width white card below. AuthCard + AuthLayout
// (src/app/(auth)/layout.tsx) split that pattern in two: the layout
// handles page-level centering (shared by all 4 screens), this
// component handles the card's own padding/width (also shared, but
// conceptually the card itself rather than "the page").
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-[576px] px-10 py-9">{children}</Card>
  );
}
