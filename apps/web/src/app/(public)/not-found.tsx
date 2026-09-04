import Link from 'next/link';

export default function PublicNotFound(): React.JSX.Element {
  return (
    <div className="container py-5 text-center">
      <h1 className="display-4 fw-bold mb-3">404</h1>
      <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
        This page doesn&apos;t exist.
      </p>
      <Link href="/" className="btn btn-primary">
        Back Home
      </Link>
    </div>
  );
}
