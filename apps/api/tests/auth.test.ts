import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/lib/password.js';

/**
 * HTTP-layer wiring for `/api/v1/auth` (docs/architecture/04): cookies,
 * CSRF, the `Origin` allow-list, `authenticate` gating, and the login rate
 * limiter. Business-logic edge cases (lockout, rotation, reuse detection)
 * are covered directly against `authService` in
 * `src/services/authService.test.ts`, which does not fight the shared,
 * in-memory login rate limiter (5 attempts / 15 min, per IP AND per email)
 * the way a long sequence of real HTTP requests from the same test process
 * would.
 *
 * `X-Forwarded-For` is set per scenario that would otherwise share the IP
 * bucket with every other `it()` in this file (supertest's requests all
 * originate from the loopback address) — `app.ts` sets `trust proxy: 1`,
 * so one forwarded hop is honoured exactly as it would be behind Caddy.
 */

const app = createApp();
const ORIGIN = env.CORS_ORIGIN[0];
if (!ORIGIN) throw new Error('test setup: env.CORS_ORIGIN is empty');

const PASSWORD = 'a-perfectly-fine-test-password-000';
const createdUserIds: number[] = [];

async function createUser() {
  const email = `http-${randomUUID()}@eslamramzy.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      name: 'HTTP Test User',
      role: 'ADMIN',
    },
  });
  createdUserIds.push(user.id);
  return { email, user };
}

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return list.map((entry) => entry.split(';')[0]).join('; ');
}

function hasCookieNamed(res: request.Response, name: string): boolean {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return list.some((entry) => entry.startsWith(`${name}=`));
}

/**
 * Reads the value a `Set-Cookie: name=value; ...` response header just set,
 * for a client that (like a real browser reading a non-`HttpOnly` cookie
 * off `document.cookie`) needs to echo that exact value back somewhere else
 * — here, as the `X-CSRF-Token` header of the next request. Combining a
 * SECOND `GET /auth/csrf` fetch's cookie with an already-authenticated
 * response's cookies would put two `__Secure-csrf` pairs in one `Cookie`
 * header; the `cookie` package's parser keeps the FIRST occurrence of a
 * repeated name, silently discarding the second — exactly the bug this
 * helper avoids by reusing the one pair a response already set instead of
 * fetching and merging in a second.
 */
function extractCookieValue(res: request.Response, name: string): string {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  const entry = list.find((candidate) => candidate.startsWith(`${name}=`));
  if (!entry) throw new Error(`test setup: no Set-Cookie for ${name}`);
  return entry.split(';')[0]!.slice(name.length + 1);
}

async function fetchCsrf(forwardedFor: string) {
  const res = await request(app).get('/api/v1/auth/csrf').set('X-Forwarded-For', forwardedFor);
  const body = res.body as { data: { csrfToken: string } };
  return { csrfToken: body.data.csrfToken, cookie: cookieHeader(res) };
}

let ipCounter = 0;
/** A fresh, never-reused source IP for scenarios that must not share a rate-limit bucket with any other test. */
function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

describe('GET /auth/csrf', () => {
  it('sets a non-HttpOnly CSRF cookie and returns the same value in the body', async () => {
    const res = await request(app).get('/api/v1/auth/csrf').set('X-Forwarded-For', freshIp());

    expect(res.status).toBe(200);
    const body = res.body as { data: { csrfToken: string } };
    expect(typeof body.data.csrfToken).toBe('string');

    const raw = res.headers['set-cookie'] as unknown;
    const list: string[] = Array.isArray(raw) ? (raw as string[]) : [];
    const csrfSetCookie = list.find((entry) => entry.startsWith('__Secure-csrf='));
    expect(csrfSetCookie).toBeDefined();
    expect(csrfSetCookie).not.toMatch(/HttpOnly/i);
  });
});

describe('POST /auth/login — CSRF and Origin enforcement', () => {
  it('rejects a request with no Origin header', async () => {
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'someone@eslamramzy.test', password: 'whatever' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: { code: 'CSRF_FAILED' } });
  });

  it('rejects a request from an origin outside the allow-list', async () => {
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', 'https://evil-eslamramzy.dev')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'someone@eslamramzy.test', password: 'whatever' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: { code: 'CSRF_FAILED' } });
  });

  it('rejects a request with a missing CSRF cookie', async () => {
    const ip = freshIp();
    const { csrfToken } = await fetchCsrf(ip);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'someone@eslamramzy.test', password: 'whatever' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: { code: 'CSRF_FAILED' } });
  });

  it('rejects a request whose header token does not match its cookie (cookie tossing)', async () => {
    const ip = freshIp();
    const legit = await fetchCsrf(ip);
    const attacker = await fetchCsrf(ip);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', legit.cookie)
      .set('X-CSRF-Token', attacker.csrfToken)
      .send({ email: 'someone@eslamramzy.test', password: 'whatever' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: { code: 'CSRF_FAILED' } });
  });
});

describe('POST /auth/login — credentials', () => {
  it('rejects bad and unknown credentials with the identical response shape', async () => {
    const { email } = await createUser();
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password: 'the-wrong-password' });

    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: 'nobody-at-all@eslamramzy.test', password: 'whatever' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
      });
    }
  });

  it('logs in successfully: 200, sets all three cookies, returns the user without a password hash', async () => {
    const { email } = await createUser();
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    const body = res.body as { data: { user: Record<string, unknown> } };
    expect(body.data.user['email']).toBe(email);
    expect(body.data.user).not.toHaveProperty('passwordHash');

    expect(hasCookieNamed(res, '__Secure-at')).toBe(true);
    expect(hasCookieNamed(res, '__Secure-rt')).toBe(true);
    expect(hasCookieNamed(res, '__Secure-csrf')).toBe(true);
  });

  it('enforces the per-IP login rate limit (5 / 15 min)', async () => {
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);
    const email = `rl-ip-${randomUUID()}@eslamramzy.test`;

    let last: request.Response | undefined;
    for (let i = 0; i < 6; i++) {
      last = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        // A different email each time — this specifically isolates the IP
        // bucket from the per-email bucket, which would otherwise also
        // trip at the 6th attempt and make this test ambiguous about which
        // bucket actually fired.
        .send({ email: `${i}-${email}`, password: 'wrong' });
    }

    expect(last?.status).toBe(429);
    expect(last?.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(last?.headers['retry-after']).toBeDefined();
  });

  it('enforces the per-email login rate limit (5 / 15 min) independent of IP', async () => {
    const email = `rl-email-${randomUUID()}@eslamramzy.test`;

    let last: request.Response | undefined;
    for (let i = 0; i < 6; i++) {
      const ip = freshIp(); // a fresh IP every time — isolates the email bucket.
      const { csrfToken, cookie } = await fetchCsrf(ip);
      last = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ email, password: 'wrong' });
    }

    expect(last?.status).toBe(429);
    expect(last?.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});

describe('authenticated session lifecycle', () => {
  it('GET /auth/me requires authentication', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('X-Forwarded-For', freshIp());
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('POST /auth/logout-all requires authentication', async () => {
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);
    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(401);
  });

  it('POST /auth/change-password requires authentication', async () => {
    const ip = freshIp();
    const { csrfToken, cookie } = await fetchCsrf(ip);
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-password-000' });
    expect(res.status).toBe(401);
  });

  it('login → me → refresh (rotates) → old refresh token now fails (reuse) → logout → me now fails', async () => {
    const { email } = await createUser();
    const ip = freshIp();
    const csrf1 = await fetchCsrf(ip);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf1.cookie)
      .set('X-CSRF-Token', csrf1.csrfToken)
      .send({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const sessionCookie = cookieHeader(loginRes);

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('X-Forwarded-For', ip)
      .set('Cookie', sessionCookie);
    expect(meRes.status).toBe(200);
    const meBody = meRes.body as { data: { user: { email: string } } };
    expect(meBody.data.user.email).toBe(email);

    // Refresh reuses the CSRF pair the login response itself just set —
    // login's own `setCsrfCookie(res, generateCsrfToken())` freshens it, and
    // a real client would read that new value straight off `document.cookie`
    // rather than fetching yet another one (see extractCookieValue's doc).
    const csrfAfterLogin = extractCookieValue(loginRes, '__Secure-csrf');
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', csrfAfterLogin);
    expect(refreshRes.status).toBe(200);
    const rotatedCookie = cookieHeader(refreshRes);
    // The rotated response must carry a NEW refresh token, not the same one.
    expect(rotatedCookie).not.toBe(sessionCookie);

    // Replaying the ORIGINAL (pre-rotation) session cookie against refresh
    // again is exactly the theft scenario doc 04 §3 describes. The CSRF
    // pair is still the one from login — refresh doesn't rotate it on
    // failure — and remains valid for this replay attempt.
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', csrfAfterLogin);
    expect(reuseRes.status).toBe(401);
    // A failed refresh clears cookies client-side too.
    expect(hasCookieNamed(reuseRes, '__Secure-at')).toBe(true); // clearCookie also emits a Set-Cookie

    // Logout using the (now-live, rotated) session — refresh did not set a
    // new CSRF cookie, so the one from login is still the active pair.
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-Forwarded-For', ip)
      .set('Origin', ORIGIN)
      .set('Cookie', `${rotatedCookie}; __Secure-csrf=${csrfAfterLogin}`)
      .set('X-CSRF-Token', csrfAfterLogin);
    expect(logoutRes.status).toBe(200);

    // The access token cookie was cleared by logout, so /me now fails.
    const afterLogoutMe = await request(app)
      .get('/api/v1/auth/me')
      .set('X-Forwarded-For', ip)
      .set('Cookie', cookieHeader(logoutRes));
    expect(afterLogoutMe.status).toBe(401);
  });
});
