import * as React from 'react';

import { Card } from '@/components/ui/card';

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-[576px] px-10 py-9">{children}</Card>
  );
}
