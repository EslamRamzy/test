/**
 * Client-visible configuration.
 *
 * Only values that are safe to ship in the browser bundle live here. Anything
 * prefixed `NEXT_PUBLIC_` is public by definition, so no secret ever gets that
 * prefix (docs/architecture/09 §9).
 */

const DEFAULT_API_URL = 'http://localhost:4000';
const DEFAULT_SITE_URL = 'http://localhost:3000';

/**
 * Public origin of the API (decision D1 — the API is a separate origin).
 *
 * Server Components do not use this: they call `API_INTERNAL_URL` over the
 * container network instead, so their traffic never leaves the host.
 */
export function getApiBaseUrl(): string {
  // An empty string is a misconfiguration, not a value — treat it as unset.
  const configured = process.env.NEXT_PUBLIC_API_URL;
  return configured !== undefined && configured.length > 0 ? configured : DEFAULT_API_URL;
}

/**
 * Server-side-only API address (docs/architecture/04 §7) — used exclusively
 * by Server Components and Route Handlers, never sent to the browser. In
 * Docker Compose this is the container-internal address; for local `next
 * dev` it is just the API's own local port. Reading `process.env` directly
 * here (not `NEXT_PUBLIC_API_INTERNAL_URL`) is what keeps it out of the
 * client bundle — anything sensitive staying server-side depends on this
 * function never being called from a Client Component.
 */
export function getApiInternalUrl(): string {
  const configured = process.env.API_INTERNAL_URL;
  return configured !== undefined && configured.length > 0 ? configured : DEFAULT_API_URL;
}

/** Used for canonical URLs, `sitemap.ts`, `robots.ts`, and OpenGraph tags. */
export function getPublicSiteUrl(): string {
  const configured = process.env.PUBLIC_SITE_URL;
  return configured !== undefined && configured.length > 0 ? configured : DEFAULT_SITE_URL;
}
