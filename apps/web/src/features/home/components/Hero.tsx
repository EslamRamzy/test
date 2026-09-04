import type { ProfileDto } from '@portfolio/shared';
import Link from 'next/link';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';

/**
 * Asymmetric hero (design concept §10): text ~60%, portrait ~40%, not a
 * centered stack. The portrait sits in a geometric frame — grid backdrop,
 * open corner brackets, soft accent-tinted gradient — never a circle
 * avatar, and never covered by decoration.
 *
 * The entrance sequence (eyebrow → name → headline → bio → buttons →
 * social → portrait) is plain CSS `animation` with staggered `animation-
 * delay`s, not `Reveal`'s IntersectionObserver: this is the first thing on
 * the page, already in the viewport at load, so it must play once on
 * mount, not wait for a scroll event that may never come ("Show the page
 * at rest" — nothing here is parked at `opacity: 0` waiting on an
 * observer, `prefers-reduced-motion` in globals.scss neutralises the
 * whole sequence to an instant, fully-visible state).
 */
export function Hero({ profile }: { profile: ProfileDto }): React.JSX.Element {
  return (
    <section className="hero">
      <div className="hero__grid-bg" aria-hidden="true" />
      <div className="container">
        {/* No `g-*` gutter utility: it sets `--bs-gutter-x` locally on
            `.row` only — `.container`'s own copy of that variable (its
            padding) stays at Bootstrap's default 1.5rem regardless, so any
            larger gutter here overflows past the container's edge. A real
            320px-viewport check caught this as horizontal page scroll on
            the homepage — confirmed via node_modules/bootstrap/scss's
            `.container`/`.row` each declaring `--bs-gutter-x` separately.
            Default gutter is the only value guaranteed to match. */}
        {/* `g-4 g-lg-5`, not a flat `g-5` — see contact/page.tsx's comment:
            `.row`'s gutter utility only overrides ITS OWN `--bs-gutter-x`,
            not `.container`'s separately-declared copy (its padding), so a
            gutter wider than the container's own default (1.5rem = `g-4`)
            overflows past its edge at narrow viewports. `.hero`'s own
            `overflow: hidden` (for the background grid's mask) would have
            hidden the resulting horizontal scrollbar rather than fixing
            the underlying clipped content, so this needed the same real
            fix as `contact/page.tsx`, not just the accidental mask. */}
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-lg-7 order-2 order-lg-1">
            <span
              className="hero__eyebrow hero__stage"
              style={{ '--stage': 0 } as React.CSSProperties}
            >
              <span className="hero__eyebrow-dot" aria-hidden="true" />
              {profile.headline ?? 'Full-Stack Developer'}
            </span>
            <h1 className="hero__name hero__stage" style={{ '--stage': 1 } as React.CSSProperties}>
              {profile.fullName}
            </h1>
            {profile.shortBio && (
              <p className="hero__bio hero__stage" style={{ '--stage': 2 } as React.CSSProperties}>
                {profile.shortBio}
              </p>
            )}
            {profile.availableForWork && (
              <span
                className="badge rounded-pill text-bg-success mb-3 hero__stage"
                style={{ '--stage': 2 } as React.CSSProperties}
              >
                <span
                  className="bi bi-circle-fill me-1"
                  style={{ fontSize: '0.5em' }}
                  aria-hidden="true"
                />
                Available for work
              </span>
            )}
            <div
              className="d-flex flex-wrap gap-3 hero__stage"
              style={{ '--stage': 3 } as React.CSSProperties}
            >
              <Link href="/projects" className="btn btn-primary hero__cta">
                View Projects
                <span className="bi bi-arrow-right ms-2" aria-hidden="true" />
              </Link>
              <Link href="/contact" className="btn btn-outline-secondary hero__cta">
                Contact Me
              </Link>
              {profile.resume && (
                <a
                  href={profile.resume.url}
                  className="btn btn-outline-secondary hero__cta"
                  download
                >
                  <span className="bi bi-download me-1" aria-hidden="true" />
                  Resume
                </a>
              )}
            </div>
            {profile.socialLinks.length > 0 && (
              <ul
                className="list-inline mb-0 mt-4 d-flex gap-3 hero__stage"
                style={{ '--stage': 4 } as React.CSSProperties}
              >
                {profile.socialLinks.map((link) => (
                  <li className="list-inline-item" key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label ?? link.platform}
                      className="hero__social"
                    >
                      <span className={link.icon ?? 'bi bi-link-45deg'} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="col-lg-5 order-1 order-lg-2">
            <div
              className="hero__portrait hero__stage"
              style={{ '--stage': 2 } as React.CSSProperties}
            >
              <span
                className="hero__portrait-corner hero__portrait-corner--tl"
                aria-hidden="true"
              />
              <span
                className="hero__portrait-corner hero__portrait-corner--br"
                aria-hidden="true"
              />
              {profile.avatar ? (
                <PublicMediaImage
                  media={profile.avatar}
                  fill
                  priority
                  sizes="(max-width: 992px) 80vw, 420px"
                  className="hero__portrait-img"
                />
              ) : (
                <div className="hero__portrait-placeholder">
                  <span className="bi bi-person" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
