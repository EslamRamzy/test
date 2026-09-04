import type { SocialLinkDto } from '@portfolio/shared';
import Link from 'next/link';

/**
 * The 10th homepage section (doc 06 §6 lists "Footer" among the ten) is
 * this component, rendered once by `(public)/layout.tsx` — every page gets
 * it, not just the homepage, since it is site chrome rather than
 * homepage-specific content.
 *
 * Minimal (design concept §18) — name, one line, nav, social, copyright.
 * No repeat of the page's own content.
 */
export function Footer({
  siteName,
  socialLinks,
}: {
  siteName: string;
  socialLinks: SocialLinkDto[];
}): React.JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <div>
            <Link href="/" className="site-footer__brand">
              {siteName}
            </Link>
            <p className="site-footer__tagline">
              Built with passion, and a healthy amount of paranoia.
            </p>
          </div>

          {socialLinks.length > 0 && (
            <ul className="list-inline mb-0 d-flex gap-3">
              {socialLinks.map((link) => (
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

        <div className="site-footer__bottom">
          <p className="mb-0">
            &copy; {year} {siteName}. All rights reserved.
          </p>
          <nav aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
