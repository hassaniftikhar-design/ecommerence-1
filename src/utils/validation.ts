// Pure, framework-free helpers used for the *local, static* validation
// messages shown in the Figma (e.g. "Enter a valid email address").
// These are deliberately simple regexes, not a real validation layer --
// Zod schemas will replace/wrap these once Route Handlers exist, but
// forms can still call these today to light up the error text the
// design calls for without any network request.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value: string): boolean {
  // Mirrors the Figma copy: "Password must contain Capital, small
  // letter, number and symbols".
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return (
    value.length >= 8 && hasUpper && hasLower && hasNumber && hasSymbol
  );
}
