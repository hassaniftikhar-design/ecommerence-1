import Link from 'next/link';

interface AuthFooterLinkProps {
  promptText: string;
  linkText: string;
  href: string;
}

// Renders things like "I don't have an account! SignUp" or "No, I
// remember my password Login" -- same shape (prompt + link) appears
// on all four auth screens with different copy/destinations.
export function AuthFooterLink({
  promptText,
  linkText,
  href
}: AuthFooterLinkProps) {
  return (
    <p className="text-center text-sm text-ink">
      {promptText}{' '}
      <Link href={href} className="text-primary hover:underline">
        {linkText}
      </Link>
    </p>
  );
}
