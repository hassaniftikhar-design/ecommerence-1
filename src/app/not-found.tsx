import Link from "next/link";

import { ROUTES } from "@/constants/routes";

// Rendered automatically for any unmatched route, or manually via
// Next's notFound() helper later once real data lookups exist
// (e.g. a product id that doesn't exist).
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-page px-4 text-center">
      <h1 className="text-4xl font-semibold text-primary">404</h1>
      <p className="text-ink">We couldn&apos;t find the page you&apos;re looking for.</p>
      <Link href={ROUTES.home} className="text-primary hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
