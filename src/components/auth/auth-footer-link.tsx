import Link from 'next/link';

interface AuthFooterLinkProps {
  promptText: string;
  linkText: string;
  href: string;
}

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
