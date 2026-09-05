'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { recordAnalyticsView } from '@/lib/api/client';

type EntityType = 'PROJECT' | 'ARTICLE' | 'RESEARCH' | 'PAGE';

export interface AnalyticsBeaconProps {
  /** `'PAGE'` for every route with no specific content entity (home, about, list pages, contact, search). */
  entityType: EntityType;
  entityId?: number;
}

/**
 * Never the site's own referrer — a client-side navigation between two of
 * this site's own pages leaves `document.referrer` pointing at the
 * PREVIOUS page here, not a real external traffic source, and that is not
 * what doc09 §10's "referrer host" is for (`getTopReferrerHosts`'s whole
 * point is external sources, e.g. "google.com").
 */
function externalReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || document.referrer.length === 0) return undefined;
  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === window.location.origin) return undefined;
    return referrer.hostname;
  } catch {
    return undefined;
  }
}

/**
 * The page-view beacon (docs/architecture/03 §3, doc09 §10, doc11 Phase
 * 13) — rendered explicitly by every public page, the same way `<JsonLd>`
 * is (one call site per page, not a single global mount in the layout):
 * only the page itself knows its own `entityType`/`entityId` at render
 * time, and a layout-level beacon reading just `usePathname()` would have
 * no way to attach a project/article's numeric id without either
 * duplicating the view (a layout-level generic beacon firing ALONGSIDE a
 * page-level specific one) or threading page-specific data back up through
 * a layout that Next's own `children: ReactNode` API has no channel for.
 *
 * `useEffect` with `[pathname]`, not `[]` — the App Router does not remount
 * this component on every client-side navigation between two ROUTES that
 * both happen to render `<AnalyticsBeacon>` at the same position in the
 * tree (e.g. one article to another), so relying on mount-only would miss
 * the second page's own view entirely.
 */
export function AnalyticsBeacon({ entityType, entityId }: AnalyticsBeaconProps): null {
  const pathname = usePathname();

  useEffect(() => {
    recordAnalyticsView({
      path: pathname,
      entityType,
      entityId,
      referrerHost: externalReferrerHost(),
    }).catch(() => {
      // Fire-and-forget (doc03 §3: "a failed beacon must never be visible
      // to them") — nothing to retry, nothing to surface.
    });
    // `entityType`/`entityId` are this component's own props, stable for the
    // lifetime of one page render — only a real navigation (a `pathname`
    // change) should fire a second beacon. (No `react-hooks` lint plugin is
    // installed in this project, so no disable directive is needed here.)
  }, [pathname]);

  return null;
}
