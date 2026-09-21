'use client';

import { Checkbox } from '@/components/ui/checkbox';

interface RememberMeProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function RememberMe({ checked, onCheckedChange }: RememberMeProps) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <Checkbox
        id="remember-me"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <label htmlFor="remember-me" className="text-sm text-muted">
        Remember me
      </label>
    </div>
  );
}
