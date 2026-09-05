import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans, Unbounded } from 'next/font/google';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import { getProfile } from '@/lib/api/endpoints';
import { getPublicSiteUrl } from '@/lib/config';
import '@/styles/globals.scss';

/**
 * Self-hosted via `next/font/google` (doc 06 §9: "self-hosted, display:
 * swap, preloaded subset") — Next downloads these at BUILD time and serves
 * them from this app's own origin; the browser never requests
 * fonts.googleapis.com, so there's no third-party request, no render-
 * blocking @import, and `display: swap` is built into the mechanism.
 *
 * Each `variable` is deliberately NOT named `--font-sans`/`--font-mono`/
 * `--font-display` — those names belong to `_tokens.scss`'s own tokens,
 * which reference the `-nf` variable below as their first fallback. Two
 * independent names avoids any doubt about which stylesheet's declaration
 * of the same custom-property name would win the cascade.
 */
const displayFont = Unbounded({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-display-nf',
  display: 'swap',
});
const sansFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-nf',
  display: 'swap',
});
const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-nf',
  display: 'swap',
});

const FALLBACK_DESCRIPTION = 'Full-stack development and application security.';

/**
 * Per-route `generateMetadata()` (doc 06 §8) supplies the real title and
 * description everywhere content exists; this is only the fallback for a
 * route that has none of its own (e.g. a genuine 404) — which is also
 * exactly what `GET /profile`'s bundled `seo.default_description` setting
 * (docs/architecture/03 §3) is FOR: a real Lighthouse run against the
 * homepage caught it going out with no `<meta name="description">` at all
 * (profile's own `headline`/`shortBio` were both unset in that data),
 * despite the API already carrying an admin-configured fallback for
 * exactly this case that nothing was reading.
 *
 * `metadataBase` is what lets every route's own `openGraph.images` (e.g.
 * `/projects/[slug]/opengraph-image`) stay a relative path instead of each
 * one re-deriving the absolute site origin itself.
 */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile().catch(() => null);
  const description =
    profile?.settings.find((setting) => setting.key === 'seo.default_description')?.value ??
    FALLBACK_DESCRIPTION;

  const siteName = profile?.fullName ?? 'Eslam Ramzy';

  return {
    metadataBase: new URL(getPublicSiteUrl()),
    title: siteName,
    description,
    // A route's own `generateMetadata()` that sets ITS OWN `openGraph` object
    // replaces this ENTIRELY rather than merging into it (Next's metadata
    // merge is shallow per top-level key — confirmed in Next's own docs), so
    // this is the fallback every route gets for free only until it defines
    // one of its own; the three detail pages that do (doc06 §8's per-route
    // OpenGraph requirement) repeat `siteName` themselves for exactly that
    // reason.
    openGraph: { siteName, type: 'website', locale: 'en_US' },
    twitter: { card: 'summary_large_image' },
  };
}

/**
 * Sets `data-theme` on `<html>` BEFORE first paint (docs/architecture/06
 * §5: "no flash"). Deliberately a plain inline script, not a React effect
 * — an effect only runs after the first paint, which is exactly the flash
 * this exists to avoid. React never renders this attribute itself (the
 * `<html>` JSX below has none), so there is nothing for hydration to
 * compare it against — see `hooks/useTheme.ts` for how the rest of the app
 * stays in sync with whatever this script decided.
 *
 * No explicit choice stored → the attribute is left unset entirely and
 * `prefers-color-scheme` in `_tokens.scss` decides, exactly like every
 * page load with JavaScript disabled.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

/**
 * `await connection()` opts every route in the app into dynamic rendering
 * (doc09 §2) — a nonce-based CSP requires it (Next's own CSP guide: nonces
 * are applied "during server-side rendering, based on the CSP header present
 * in the request... Static pages are generated at build time, when no
 * request or response headers exist — so no nonce can be injected"). Called
 * here, in the ROOT layout every route renders through, rather than in each
 * page individually — Next's dynamic APIs make the whole subtree under the
 * component that calls them dynamic, so one call here covers the entire
 * site instead of repeating it per route.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}>
      <head>
        {/* Plain JSX children, not dangerouslySetInnerHTML — restricted
            repo-wide to lib/markdown/render.ts (eslint.config.mjs). This
            script is a static string constant with no `<`/`&` in it, so
            React's usual text-child escaping has nothing to mangle.
            `nonce` is what lets this one specific inline script run under
            doc09 §2's `script-src 'nonce-...'` CSP with no `unsafe-inline`. */}
        <script nonce={nonce}>{THEME_INIT_SCRIPT}</script>
      </head>
      <body>{children}</body>
    </html>
  );
}
