'use client';

// error.tsx MUST be a Client Component -- Next.js requires this
// because it needs to catch errors thrown during rendering on the
// client and receives a `reset()` callback to attempt re-rendering,
// both of which only make sense in the browser runtime.
import { useEffect } from 'react';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(backend-integration): send `error` to a real logging
    // service (Sentry, etc.) once one is wired up.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-page px-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">
        Something went wrong
      </h1>
      <p className="text-muted">Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Try again
      </button>
    </div>
  );
}
