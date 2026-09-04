import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { signAccessToken, verifyAccessToken } from './jwt.js';

const CLAIMS = { sub: '42', role: 'ADMIN', tokenVersion: 3 };

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips valid claims', () => {
    const token = signAccessToken(CLAIMS);
    const result = verifyAccessToken(token);

    expect(result.outcome).toBe('valid');
    if (result.outcome === 'valid') {
      expect(result.claims.sub).toBe(CLAIMS.sub);
      expect(result.claims.role).toBe(CLAIMS.role);
      expect(result.claims.tokenVersion).toBe(CLAIMS.tokenVersion);
      expect(typeof result.claims.jti).toBe('string');
      expect(typeof result.claims.iat).toBe('number');
      expect(typeof result.claims.exp).toBe('number');
    }
  });

  it('assigns a different jti to every token', () => {
    const a = verifyAccessToken(signAccessToken(CLAIMS));
    const b = verifyAccessToken(signAccessToken(CLAIMS));
    expect(a.outcome).toBe('valid');
    expect(b.outcome).toBe('valid');
    if (a.outcome === 'valid' && b.outcome === 'valid') {
      expect(a.claims.jti).not.toBe(b.claims.jti);
    }
  });

  it('reports "expired" for an already-expired token', () => {
    const token = jwt.sign(CLAIMS, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
      issuer: 'eslam-ramzy-portfolio-api',
      audience: 'eslam-ramzy-portfolio-admin',
    });
    expect(verifyAccessToken(token)).toEqual({ outcome: 'expired' });
  });

  it('reports "invalid" for a token signed with the wrong secret', () => {
    const token = jwt.sign(CLAIMS, 'a-completely-different-secret-value-32-chars-plus', {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'eslam-ramzy-portfolio-api',
      audience: 'eslam-ramzy-portfolio-admin',
    });
    expect(verifyAccessToken(token)).toEqual({ outcome: 'invalid' });
  });

  it('reports "invalid" for a malformed token', () => {
    expect(verifyAccessToken('not-a-jwt-at-all')).toEqual({ outcome: 'invalid' });
  });

  it('reports "invalid" for a token with the wrong issuer', () => {
    const token = jwt.sign(CLAIMS, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'someone-elses-issuer',
      audience: 'eslam-ramzy-portfolio-admin',
    });
    expect(verifyAccessToken(token)).toEqual({ outcome: 'invalid' });
  });

  it('reports "invalid" for a token with the wrong audience', () => {
    const token = jwt.sign(CLAIMS, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'eslam-ramzy-portfolio-api',
      audience: 'someone-elses-audience',
    });
    expect(verifyAccessToken(token)).toEqual({ outcome: 'invalid' });
  });

  it('reports "invalid" for a token signed with "none" (alg confusion)', () => {
    // Manually assembles an unsigned JWT rather than asking jsonwebtoken to
    // sign with `alg: none` (which it refuses to do without an explicit
    // opt-in) — this is exactly the forged-token shape the explicit
    // `algorithms: ['HS256']` allow-list in verifyAccessToken exists to
    // reject regardless of what the token's own header claims.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        ...CLAIMS,
        iss: 'eslam-ramzy-portfolio-api',
        aud: 'eslam-ramzy-portfolio-admin',
      }),
    ).toString('base64url');
    const forged = `${header}.${payload}.`;
    expect(verifyAccessToken(forged)).toEqual({ outcome: 'invalid' });
  });

  it('reports "invalid" when a required claim is missing', () => {
    const token = jwt.sign({ sub: '42' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'eslam-ramzy-portfolio-api',
      audience: 'eslam-ramzy-portfolio-admin',
    });
    expect(verifyAccessToken(token)).toEqual({ outcome: 'invalid' });
  });
});
