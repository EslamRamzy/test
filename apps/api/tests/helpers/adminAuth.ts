import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/config/prisma.js';
import { hashPassword } from '../../src/lib/password.js';

/**
 * Shared real-HTTP admin-auth helper for Phase 8's admin CRUD integration
 * tests. `tests/auth.test.ts` and `tests/adminOverview.test.ts` each keep
 * their own copy of this same shape deliberately (their own headers say
 * why: one or two call sites don't earn an abstraction). Phase 8 changes
 * that math — every one of ~10 admin CRUD test files needs the identical
 * login flow, so here the duplication itself became the maintenance risk
 * (a fix to the login flow would otherwise need repeating across ten
 * files) — extracted once real duplication at this scale made it the
 * clearly better trade, not by default.
 */

const PASSWORD = 'a-perfectly-fine-test-password-000';

export interface AdminTestUser {
  email: string;
  userId: number;
}

export async function createAdminTestUser(): Promise<AdminTestUser> {
  const email = `http-${randomUUID()}@eslamramzy.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      name: 'HTTP Test User',
      role: 'ADMIN',
    },
  });
  return { email, userId: user.id };
}

export function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown;
  const list: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  return list.map((entry) => entry.split(';')[0]).join('; ');
}

/**
 * Reads one cookie's value back out of a `cookieHeader()`-shaped
 * "name=value; name2=value2" string — needed because `authController.login`
 * rotates `__Secure-csrf` to a brand-new signed token on every successful
 * login (`setCsrfCookie(res, generateCsrfToken())`), so the pre-login token
 * `GET /auth/csrf` returned is stale the instant login succeeds. Confirmed
 * the hard way: before this existed, every admin-CRUD test here sent that
 * stale token as `X-CSRF-Token` after login — silently fine only because
 * the admin routes had no `csrfProtection` mounted yet to notice the
 * mismatch; wiring it in made every one of these tests fail with a real
 * 403, not a bug in the routes but in this helper reusing the wrong token.
 */
export function extractCookieValue(cookieHeaderValue: string, name: string): string {
  const prefix = `${name}=`;
  const pair = cookieHeaderValue.split('; ').find((entry) => entry.startsWith(prefix));
  if (!pair) throw new Error(`test setup: cookie "${name}" not found in "${cookieHeaderValue}"`);
  return pair.slice(prefix.length);
}

let ipCounter = 0;
/** A fresh, never-reused source IP so tests across files never share a rate-limit bucket. */
export function freshIp(): string {
  ipCounter += 1;
  return `10.3.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

export interface AdminSession {
  cookie: string;
  ip: string;
  csrfToken: string;
  userId: number;
}

/** Real GET /auth/csrf → POST /auth/login, against the real app — returns everything a subsequent authenticated+CSRF-protected request needs. */
export async function loginAsAdmin(app: Express, origin: string): Promise<AdminSession> {
  const { email, userId } = await createAdminTestUser();
  const ip = freshIp();

  const csrfRes = await request(app).get('/api/v1/auth/csrf').set('X-Forwarded-For', ip);
  const csrfBody = csrfRes.body as { data: { csrfToken: string } };
  const csrfCookie = cookieHeader(csrfRes);

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', ip)
    .set('Origin', origin)
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrfBody.data.csrfToken)
    .send({ email, password: PASSWORD });

  if (loginRes.status !== 200) {
    throw new Error(
      `test setup: login failed with ${loginRes.status}: ${JSON.stringify(loginRes.body)}`,
    );
  }

  const cookie = cookieHeader(loginRes);
  // Not `csrfBody.data.csrfToken` — see `extractCookieValue`'s own comment.
  const csrfToken = extractCookieValue(cookie, '__Secure-csrf');

  return { cookie, ip, csrfToken, userId };
}
