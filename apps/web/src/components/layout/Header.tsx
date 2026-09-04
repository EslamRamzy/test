'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/articles', label: 'Articles' },
  { href: '/security', label: 'Security' },
  { href: '/experience', label: 'Experience' },
] as const;

/**
 * Nav labels ("About", "Projects", ...) are UI chrome, not content — the
 * "zero hardcoded content" exit criterion (doc 11 Phase 6) is about
 * biographical/portfolio data, not English interface microcopy. `siteName`
 * IS content (the person's actual name) and always comes from the caller,
 * which reads it from `GET /profile` (doc 03 §3) — this component never
 * fetches anything itself (doc 06 §3: "components render... never call
 * fetch directly").
 *
 * `react-bootstrap`'s `Navbar`/`Nav` toggle the mobile menu via React state
 * rather than Bootstrap's own vanilla-JS `data-bs-toggle` bundle — no
 * separate Bootstrap JS include is needed anywhere in the app because of
 * that, which is the whole reason `react-bootstrap` is a dependency here
 * rather than `bootstrap`'s own JS.
 *
 * Floating/transparent at the top of the page, blurred with a hairline
 * border once scrolled (design concept §09 Navbar) — `.site-header` and
 * `.site-header--scrolled` are defined in `styles/_components.scss`. The
 * scroll listener is passive and only ever flips a boolean, so it never
 * runs more work than a single class-list comparison per scroll frame.
 */
export function Header({ siteName }: { siteName: string }): React.JSX.Element {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A route change is the one thing a full-screen mobile menu can't dismiss itself.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <Navbar
      expand="md"
      className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}
      expanded={menuOpen}
      onToggle={setMenuOpen}
    >
      <Container className="d-flex align-items-center">
        <Navbar.Brand as={Link} href="/" className="site-header__brand">
          <span className="site-header__brand-dot" aria-hidden="true" />
          {siteName}
        </Navbar.Brand>
        {/* A plain button, not `Navbar.Toggle` — that renders Bootstrap's
            SVG hamburger icon, baked from the LIGHT theme's stroke color at
            build time (same `.navbar`-local-redeclaration pattern already
            documented in `_theme-vars.scss`) and invisible in dark mode.
            Three `currentColor` bars sidesteps the whole SVG-baked-color
            problem and gets a free open/close morph via CSS. */}
        <button
          type="button"
          className={`site-header__toggle${menuOpen ? ' site-header__toggle--open' : ''}`}
          aria-controls="primary-nav"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <Navbar.Collapse id="primary-nav" className="site-header__menu">
          <Nav className="ms-auto align-items-md-center gap-md-1 site-header__links" as="ul">
            {NAV_LINKS.map((link, index) => (
              <Nav.Item as="li" key={link.href} style={{ '--i': index } as React.CSSProperties}>
                <Nav.Link as={Link} href={link.href}>
                  {link.label}
                </Nav.Link>
              </Nav.Item>
            ))}
            <Nav.Item
              as="li"
              className="site-header__theme"
              style={{ '--i': NAV_LINKS.length } as React.CSSProperties}
            >
              <ThemeToggle />
            </Nav.Item>
            <Nav.Item
              as="li"
              className="site-header__cta-item"
              style={{ '--i': NAV_LINKS.length + 1 } as React.CSSProperties}
            >
              <Link href="/contact" className="btn btn-primary site-header__cta">
                Let&rsquo;s Talk
              </Link>
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
