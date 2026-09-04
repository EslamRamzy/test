import type { ProfileDto } from '@portfolio/shared';
import Link from 'next/link';

export function AboutPreview({ profile }: { profile: ProfileDto }): React.JSX.Element | null {
  if (!profile.fullBio && !profile.shortBio) return null;

  return (
    <section className="py-5 border-bottom">
      <div className="container">
        <h2 className="h3 mb-3">About</h2>
        <p className="mb-3" style={{ maxWidth: '70ch' }}>
          {profile.fullBio ?? profile.shortBio}
        </p>
        <Link href="/about" className="link-primary">
          Read more <span className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
