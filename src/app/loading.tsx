// Automatically shown by Next.js while a route segment's Server
// Component data-fetch is in flight (streamed in via Suspense under
// the hood). Nothing here needs "use client" -- it's static markup.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page">
      <div
        role="status"
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"
      />
    </div>
  );
}
