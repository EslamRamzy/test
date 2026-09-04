'use client';

/**
 * Catches an error thrown by the ROOT layout itself (docs/architecture/06
 * §2) — the one case `(public)/error.tsx` cannot catch, since a layout
 * error happens above where that boundary lives. Must render its own
 * `<html>`/`<body>` (Next's own requirement) because the root layout that
 * would normally provide them is exactly what failed.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}
      >
        <h1>Something went wrong</h1>
        <p>The application couldn&apos;t load. Please try again.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
