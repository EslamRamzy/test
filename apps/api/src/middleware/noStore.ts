import type { NextFunction, Request, Response } from 'express';

/**
 * `Cache-Control: no-store, private` on every admin response
 * (docs/architecture/07 §7: "All admin responses are Cache-Control:
 * no-store, private"). Mounted once on the `/api/v1/admin` prefix in
 * `app.ts`, rather than per-route — every admin route needs this, and a
 * route added later without remembering to set it is exactly the failure
 * mode a prefix-level mount avoids. Admin data is per-session and
 * frequently mutated; a cache (browser, CDN, or a shared proxy) holding a
 * stale copy would leak content across sessions or show a stale draft
 * count on the dashboard.
 */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, private');
  next();
}
