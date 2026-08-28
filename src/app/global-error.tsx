"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Something went wrong!</h2>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-[#007BFF] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
