import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Access-token JWT (docs/architecture/04 §1) — HS256, 15-minute default
 * lifetime, `sub`/`role`/`tokenVersion` plus the standard `iat`/`exp`/`iss`/
 * `aud`/`jti` claims. The refresh token is deliberately NOT a JWT — see
 * lib/refreshToken.ts — so this file is the only place a token gets signed.
 */

const ISSUER = 'eslam-ramzy-portfolio-api';
const AUDIENCE = 'eslam-ramzy-portfolio-admin';

export interface AccessTokenClaims {
  sub: string;
  role: string;
  tokenVersion: number;
}

export interface VerifiedAccessToken extends AccessTokenClaims {
  iat: number;
  exp: number;
  jti: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, {
    algorithm: 'HS256',
    // `expiresIn` is typed as jsonwebtoken's own branded `StringValue`
    // (`${number}${unit}`, from the `ms` package) rather than a plain
    // `string`. `env.JWT_ACCESS_TTL` is validated by env.ts's Zod schema to
    // be a non-empty string, not against that specific format, so the cast
    // is required — `NonNullable<...>` rather than the bare property type
    // because `exactOptionalPropertyTypes` rejects assigning a value whose
    // static type includes `undefined` to an optional property, even when,
    // as here, the cast value can never actually be `undefined`.
    expiresIn: env.JWT_ACCESS_TTL as NonNullable<jwt.SignOptions['expiresIn']>,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: randomUUID(),
  });
}

export type VerifyAccessTokenResult =
  | { outcome: 'valid'; claims: VerifiedAccessToken }
  | { outcome: 'expired' }
  | { outcome: 'invalid' };

/**
 * Never throws — every failure mode (expired, tampered, wrong algorithm,
 * malformed) is a plain return value the caller switches on. `authenticate`
 * middleware maps `'expired'` to `TokenExpiredError` (401, "call
 * /auth/refresh") and `'invalid'` to the generic `UnauthenticatedError`
 * (docs/architecture/03 §1) — that distinction is the whole reason this
 * returns a tagged result instead of throwing one exception type.
 *
 * `algorithms: ['HS256']` is passed explicitly and is not optional: without
 * it, a library that honours an attacker-supplied `alg` header is exactly
 * how the classic "alg: none" / algorithm-confusion JWT forgery works.
 */
export function verifyAccessToken(token: string): VerifyAccessTokenResult {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof decoded === 'string') {
      return { outcome: 'invalid' };
    }

    const { sub, role, tokenVersion, iat, exp, jti } = decoded;
    if (
      typeof sub !== 'string' ||
      typeof role !== 'string' ||
      typeof tokenVersion !== 'number' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number' ||
      typeof jti !== 'string'
    ) {
      return { outcome: 'invalid' };
    }

    return { outcome: 'valid', claims: { sub, role, tokenVersion, iat, exp, jti } };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { outcome: 'expired' };
    }
    // JsonWebTokenError (bad signature, malformed, wrong algorithm) and
    // NotBeforeError both collapse to the same generic outcome — the client
    // cannot act differently on either, and distinguishing them in the
    // response would tell an attacker more than they already know.
    return { outcome: 'invalid' };
  }
}
