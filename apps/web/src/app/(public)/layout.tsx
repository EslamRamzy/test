import type { ReactNode } from 'react';
import { CustomCursor } from '@/components/layout/CustomCursor';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { PageTransition } from '@/components/layout/PageTransition';
import { getProfile } from '@/lib/api/endpoints';

/**
 * Public-site chrome (docs/architecture/06 §2): Header, Footer, and the
 * skip-to-content link, shared by every public route. `(admin)` gets a
 * completely separate layout with no shared chrome (doc 06 §20: the admin
 * must be visibly and structurally distinct).
 *
 * Fetches the profile ONCE, here, and passes the name/social links down —
 * `Header`/`Footer` stay presentational (doc 06 §3: components render,
 * they do not fetch).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  const siteName = profile?.fullName ?? 'Portfolio';
  const socialLinks = profile?.socialLinks ?? [];

  return (
    <>
      <CustomCursor />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header siteName={siteName} />
      <main id="main-content" className="flex-grow-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer siteName={siteName} socialLinks={socialLinks} />
    </>
  );
}
