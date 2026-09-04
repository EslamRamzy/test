import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Signed double-submit CSRF token (docs/architecture/04 §5).
 *
 * Format: `${nonce}.${issuedAtMs}.${signature}`, where
 * `signature = HMAC-SHA256(nonce + '.' + issuedAtMs, CSRF_SECRET)`. The
 * cookie carries the whole string; the client echoes it back verbatim in
 * `X-CSRF-Token`; the server recomputes the signature and compares.
 *
 * This is a deliberate refinement of doc 04 §5's `HMAC(value + sessionId,
 * CSRF_SECRET)` description. That phrasing implies binding the token to a
 * server-tracked "session" — but this architecture has no session store
 * (auth state lives in `refresh_tokens`, keyed by family, not by a
 * lightweight session concept that exists before login too, which is
 * required here since login itself needs CSRF protection). Binding to a
 * nonexistent session id was going to mean inventing one just for this. The
 * security property doc 04 §5 actually needs — a tossed cookie from a
 * sibling subdomain cannot be forged into a valid pair — comes entirely
 * from the HMAC secret, which an attacker does not have: they can set a
 * cookie to any value they like, but they cannot produce a value+signature
 * pair that verifies, so a forged or tossed cookie is rejected regardless.
 * The timestamp adds what session-binding would have given for free —
 * bounding how long a captured token stays valid — via TOKEN_TTL_MS below,
 * without requiring a session store this project does not otherwise have.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NONCE_BYTES = 32;

function sign(nonce: string, issuedAtMs: string): string {
  return createHmac('sha256', env.CSRF_SECRET).update(`${nonce}.${issuedAtMs}`).digest('base64url');
}

/** Generates a fresh token. Called by `GET /auth/csrf` — no auth required, since login itself needs one. */
export function generateCsrfToken(): string {
  const nonce = randomBytes(NONCE_BYTES).toString('base64url');
  const issuedAtMs = Date.now().toString();
  const signature = sign(nonce, issuedAtMs);
  return `${nonce}.${issuedAtMs}.${signature}`;
}

/**
 * Verifies a token by recomputing its signature and comparing in constant
 * time (docs/architecture/04 §5: "the server compares them in constant
 * time" — a `===` comparison would let a timing side-channel narrow down
 * the correct signature byte by byte). Rejects a well-signed but expired
 * token, and a well-signed token whose two halves (cookie vs header) were
 * swapped or mismatched by requiring the caller to pass both and compare
 * the whole strings, not just the signature.
 */
export function verifyCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [nonce, issuedAtMs, signature] = parts;
  if (!nonce || !issuedAtMs || !signature) return false;

  const issuedAt = Number(issuedAtMs);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS || issuedAt > Date.now()) {
    return false;
  }

  const expected = sign(nonce, issuedAtMs);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  // timingSafeEqual throws on a length mismatch rather than returning false
  // — an attacker-controlled signature of the wrong length is common enough
  // (any tampered token) that this must be handled, not left to throw past
  // the CSRF middleware into the generic error handler.
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Compares the cookie value against the `X-CSRF-Token` header value: they
 * must be byte-for-byte identical AND independently valid. Requiring
 * equality (not just "both valid") is what makes this "double-submit" — a
 * request carrying someone else's validly-signed token in the header but a
 * different one in the cookie is still rejected.
 */
export function verifyCsrfPair(
  cookieToken: string | undefined,
  headerToken: string | undefined,
): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;
  if (!timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) return false;
  return verifyCsrfToken(cookieToken);
}
