import type { SocialLinkDto } from '@portfolio/shared';
import Link from 'next/link';

/**
 * The 10th homepage section (doc 06 §6 lists "Footer" among the ten) is
 * this component, rendered once by `(public)/layout.tsx` — every page gets
 * it, not just the homepage, since it is site chrome rather than
 * homepage-specific content.
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
    <footer className="border-top mt-auto py-4" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3">
        <p className="mb-0 small" style={{ color: 'var(--color-text-muted)' }}>
          &copy; {year} {siteName}. All rights reserved.
        </p>

        {socialLinks.length > 0 && (
          <ul className="list-inline mb-0 d-flex gap-3">
            {socialLinks.map((link) => (
              <li className="list-inline-item" key={link.id}>
                <Link
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label ?? link.platform}
                  className="link-secondary"
                >
                  <span className={link.icon ?? 'bi bi-link-45deg'} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
