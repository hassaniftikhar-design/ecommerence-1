import Link from 'next/link';

import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** e.g. "/orders" -- ?page=N is appended for each link. */
  basePath: string;
}

// Deliberately NOT a Client Component. Every link is a plain <Link
// href="/orders?page=2">, so the browser (and Next's router) handles
// navigation -- no onClick handlers, no useState for "current page".
// This means OrdersPage can stay a Server Component that reads
// `searchParams.page` directly, which is the whole optimization: zero
// client JS shipped just to paginate a static list.
export function Pagination({
  currentPage,
  totalPages,
  basePath
}: PaginationProps) {
  const pageHref = (page: number) => `${basePath}?page=${page}`;

  const linkClass = (disabled = false) =>
    cn(
      'flex h-11 min-w-[44px] items-center justify-center rounded border border-primary px-4 text-sm font-medium text-primary',
      disabled
        ? 'pointer-events-none opacity-50'
        : 'hover:bg-surface-page'
    );

  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      <Link
        href={pageHref(currentPage - 1)}
        aria-disabled={currentPage <= 1}
        className={linkClass(currentPage <= 1)}
      >
        Previous
      </Link>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Link
          key={page}
          href={pageHref(page)}
          aria-current={page === currentPage ? 'page' : undefined}
          className={cn(
            linkClass(),
            page === currentPage && 'bg-primary text-white hover:bg-primary'
          )}
        >
          {page}
        </Link>
      ))}

      <Link
        href={pageHref(currentPage + 1)}
        aria-disabled={currentPage >= totalPages}
        className={linkClass(currentPage >= totalPages)}
      >
        Next
      </Link>
    </nav>
  );
}
