import Link from 'next/link';

export default function ResearchNotFound(): React.JSX.Element {
  return (
    <div className="container py-5 text-center">
      <h1 className="h2 mb-3">Research not found</h1>
      <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
        This piece doesn&apos;t exist, or isn&apos;t published yet.
      </p>
      <Link href="/security" className="btn btn-primary">
        Back to Security Research
      </Link>
    </div>
  );
}
