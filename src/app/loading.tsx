
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
