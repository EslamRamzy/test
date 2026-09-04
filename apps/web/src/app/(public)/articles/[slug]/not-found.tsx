import Link from 'next/link';

export default function ArticleNotFound(): React.JSX.Element {
  return (
    <div className="container py-5 text-center">
      <h1 className="h2 mb-3">Article not found</h1>
      <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
        This article doesn&apos;t exist, or isn&apos;t published yet.
      </p>
      <Link href="/articles" className="btn btn-primary">
        Back to Articles
      </Link>
    </div>
  );
}
