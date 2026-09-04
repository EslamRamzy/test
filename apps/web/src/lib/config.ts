/**
 * Client-visible configuration.
 *
 * Only values that are safe to ship in the browser bundle live here. Anything
 * prefixed `NEXT_PUBLIC_` is public by definition, so no secret ever gets that
 * prefix (docs/architecture/09 §9).
 */

const DEFAULT_API_URL = 'http://localhost:4000';

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
