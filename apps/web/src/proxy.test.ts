import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { proxy } from './proxy';

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`https://eslamramzy.dev${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

const ACCESS_COOKIE = '__Secure-at=a-jwt-value';

afterEach(() => {
  delete process.env['NEXT_PUBLIC_API_URL'];
});

describe('proxy — CSP', () => {
  it('sets an enforcing Content-Security-Policy on a public route, with no report-only header', () => {
    const res = proxy(request('/'));
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
  });

  it('includes a script-src nonce, strict-dynamic, and no unsafe-inline/unsafe-eval in production', () => {
    const csp = proxy(request('/about')).headers.get('Content-Security-Policy') ?? '';
    const scriptSrc = csp.split(';').find((directive) => directive.trim().startsWith('script-src'));
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it("uses 'unsafe-inline' for style-src, not a nonce (doc09 §2 — nonces don't cover inline style attributes)", () => {
    const csp = proxy(request('/')).headers.get('Content-Security-Policy') ?? '';
    const styleSrc = csp.split(';').find((directive) => directive.trim().startsWith('style-src'));
    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).not.toMatch(/nonce-/);
  });

  it("threads the API's public origin into img-src and connect-src", () => {
    process.env['NEXT_PUBLIC_API_URL'] = 'https://api.eslamramzy.dev';
    const csp = proxy(request('/')).headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("img-src 'self' data: blob: https://api.eslamramzy.dev");
    expect(csp).toContain("connect-src 'self' https://api.eslamramzy.dev");
  });

  it('generates a fresh nonce per request, not a fixed value', () => {
    const first = proxy(request('/')).headers.get('Content-Security-Policy');
    const second = proxy(request('/')).headers.get('Content-Security-Policy');
    expect(first).not.toEqual(second);
  });

  it('sets the CSP header on /admin routes too, alongside the existing auth redirect', () => {
    const res = proxy(request('/admin', ACCESS_COOKIE));
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });
});

describe('proxy — /admin auth redirect (pre-existing behaviour, unchanged by CSP)', () => {
  it('redirects an unauthenticated /admin/* request to the login page, preserving `from`', () => {
    const res = proxy(request('/admin/projects'));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.pathname).toBe('/admin/login');
    expect(location.searchParams.get('from')).toBe('/admin/projects');
  });

  it('lets an authenticated /admin/* request through with Cache-Control: no-store', () => {
    const res = proxy(request('/admin/projects', ACCESS_COOKIE));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store, private');
  });

  it('redirects an already-authenticated visitor away from /admin/login', () => {
    const res = proxy(request('/admin/login', ACCESS_COOKIE));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/admin');
  });

  it('shows the login page itself for an unauthenticated visitor', () => {
    const res = proxy(request('/admin/login'));
    expect(res.status).toBe(200);
  });

  it('does not apply the admin no-store/redirect logic to a public route', () => {
    const res = proxy(request('/projects'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).not.toBe('no-store, private');
  });
});
