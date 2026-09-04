import type { ProfileDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';

export function Hero({ profile }: { profile: ProfileDto }): React.JSX.Element {
  return (
    <section className="py-5 py-md-6 border-bottom">
      <div className="container">
        {/* No `g-*` gutter utility: it sets `--bs-gutter-x` locally on
            `.row` only — `.container`'s own copy of that variable (its
            padding) stays at Bootstrap's default 1.5rem regardless, so any
            larger gutter here overflows past the container's edge. A real
            320px-viewport check caught this as horizontal page scroll on
            the homepage — confirmed via node_modules/bootstrap/scss's
            `.container`/`.row` each declaring `--bs-gutter-x` separately.
            Default gutter is the only value guaranteed to match. */}
        <div className="row align-items-center">
          <div className="col-md-8">
            <h1 className="display-5 fw-bold mb-2">{profile.fullName}</h1>
            {profile.headline && (
              <p className="fs-4 mb-3" style={{ color: 'var(--color-text-muted)' }}>
                {profile.headline}
              </p>
            )}
            {profile.availableForWork && (
              <span className="badge rounded-pill text-bg-success mb-3">
                <span
                  className="bi bi-circle-fill me-1"
                  style={{ fontSize: '0.5em' }}
                  aria-hidden="true"
                />
                Available for work
              </span>
            )}
            {profile.shortBio && (
              <p className="mb-4" style={{ maxWidth: '60ch' }}>
                {profile.shortBio}
              </p>
            )}
            <div className="d-flex flex-wrap gap-2">
              <Link href="/projects" className="btn btn-primary">
                View Projects
              </Link>
              <Link href="/contact" className="btn btn-outline-secondary">
                Get in Touch
              </Link>
              {profile.resume && (
                <a href={profile.resume.url} className="btn btn-outline-secondary" download>
                  <span className="bi bi-download me-1" aria-hidden="true" />
                  Resume
                </a>
              )}
            </div>
          </div>
          {profile.avatar && (
            <div className="col-md-4 text-center">
              <PublicMediaImage
                media={profile.avatar}
                width={280}
                height={280}
                priority
                className="rounded-circle border"
                sizes="(max-width: 768px) 200px, 280px"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
