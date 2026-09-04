// Declaration merging for Express's Request type. Kept as a single project-wide
// file per docs/architecture/08 §2 rather than scattered `declare global` blocks.
//
// `req.id` is deliberately NOT declared here. `pino-http` already augments
// Node's own `http.IncomingMessage` (which `Request` extends) with
// `id: ReqId` (`ReqId = string | number | object`) — see
// node_modules/pino-http's own `.d.ts`. Redeclaring it here as `string`
// created a real, empirically-confirmed conflict (`tsc` resolved `req.id`
// to the wider `ReqId` in some files and the narrower `string` in others,
// depending on import order) rather than the clean override one might
// expect. `middleware/requestId.ts` exports `getRequestId(req)` to narrow
// `ReqId` down to the `string` this app actually ever assigns, in the one
// place that needs to, instead of fighting pino-http's ambient type.

import type { UserRole } from '@portfolio/shared';

declare global {
  namespace Express {
    /**
     * Set by `middleware/authenticate.ts` once a request's access token has
     * been verified against the database (not just the JWT signature —
     * `tokenVersion` and `isActive` are re-checked on every request, so this
     * is only ever present on a request that is currently, not just
     * formerly, authenticated). Absent on every route `authenticate` is not
     * mounted on.
     */
    interface Request {
      user?: {
        id: number;
        role: UserRole;
        tokenVersion: number;
      };
    }
  }
}

export {};
