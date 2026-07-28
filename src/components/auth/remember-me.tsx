"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface RememberMeProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

// Small enough to inline in LoginForm, but pulled out as its own
// component because "remember me" is a named, recognizable concept in
// the product (and the brief's example component list calls it out
// explicitly), not just a generic checkbox+label pairing.
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
