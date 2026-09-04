'use client';

import Link from 'next/link';
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
  { href: '/contact', label: 'Contact' },
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
 */
export function Header({ siteName }: { siteName: string }): React.JSX.Element {
  return (
    <Navbar
      expand="md"
      className="border-bottom sticky-top py-2"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <Container>
        <Navbar.Brand as={Link} href="/" className="fw-semibold">
          {siteName}
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="primary-nav" aria-label="Toggle navigation" />
        <Navbar.Collapse id="primary-nav">
          <Nav className="ms-auto align-items-md-center gap-md-1" as="ul">
            {NAV_LINKS.map((link) => (
              <Nav.Item as="li" key={link.href}>
                <Nav.Link as={Link} href={link.href}>
                  {link.label}
                </Nav.Link>
              </Nav.Item>
            ))}
            <Nav.Item as="li" className="ms-md-2 mt-2 mt-md-0">
              <ThemeToggle />
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
