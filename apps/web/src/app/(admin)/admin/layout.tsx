import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * `/admin/*` root layout (docs/architecture/07 §1, §7) — structurally and
 * visually separate from the public `(public)` group's layout: no shared
 * navbar/footer, no motion system, a different accent (`.admin-shell` in
 * `_components.scss`).
 *
 * `dynamic = 'force-dynamic'` rules out static prerendering for every page
 * under this layout; the actual `Cache-Control: no-store, private` response
 * header is set in `proxy.ts` (a layout has no access to set response
 * headers itself — only middleware and Route Handlers do), which already
 * runs on this exact `/admin/:path*` matcher. Together these are the
 * frontend half of "no admin response is cacheable" (doc 07 §7) — the
 * backend half (`Cache-Control: no-store, private` on every `/api/v1/admin`
 * response) is `apps/api/src/middleware/noStore.ts`. Every admin page is
 * either an unauthenticated form (login, change-password) or reads a
 * signed-in user's own data — neither should ever be served from a shared
 * cache, static or CDN.
 *
 * `robots: { index: false, follow: false }` duplicates `robots.ts`'s own
 * `disallow: ['/admin']` deliberately, not redundantly — `robots.txt` only
 * asks well-behaved crawlers not to fetch the path at all; the per-page
 * meta tag is what stops a page that got indexed some other way (a stray
 * inbound link) from actually appearing in search results.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { template: '%s · Admin', default: 'Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="admin-shell">{children}</div>;
}
