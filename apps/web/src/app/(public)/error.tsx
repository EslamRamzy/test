'use client';

import { useEffect } from 'react';

/**
 * Next's error boundary for every public route (docs/architecture/06 §4) —
 * catches anything `serverClient.ts` throws that a page did not itself
 * handle (a non-404 `ApiError`, a network failure). Must be a Client
 * Component (Next's own requirement for `error.tsx`).
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- client-side error boundary; there is no server log to reach from here
    console.error(error);
  }, [error]);

  return (
    <div className="container py-5 text-center">
      <h1 className="h2 mb-3">Something went wrong</h1>
      <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
        This page couldn&apos;t load right now. Please try again.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
