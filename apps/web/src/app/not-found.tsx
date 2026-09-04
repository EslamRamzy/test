import Link from 'next/link';

/**
 * Root-level fallback (docs/architecture/06 §2) — catches a URL that
 * doesn't match any route at all, outside every route group. `(public)/
 * not-found.tsx` handles the far more common case (`notFound()` called
 * from within a public page) with the site's own header/footer chrome;
 * this one intentionally has none, since it can be reached before any
 * layout — including `(public)`'s — has resolved.
 */
export default function RootNotFound(): React.JSX.Element {
  return (
    <div className="container py-5 text-center">
      <h1 className="display-4 fw-bold mb-3">404</h1>
      <p className="mb-4 text-secondary">This page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary">
        Back Home
      </Link>
    </div>
  );
}
