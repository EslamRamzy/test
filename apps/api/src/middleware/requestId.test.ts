import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requestId } from './requestId.js';

function buildApp() {
  const app = express();
  app.use(requestId);
  app.get('/', (req, res) => {
    res.json({ id: req.id });
  });
  return app;
}

describe('requestId middleware — over real HTTP', () => {
  it('generates an id when none is supplied', async () => {
    const response = await request(buildApp()).get('/');

    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-request-id']).toBe(response.body.id);
  });

  it('reuses a well-formed incoming X-Request-Id', async () => {
    const response = await request(buildApp()).get('/').set('X-Request-Id', 'trace-abc123');

    expect(response.body.id).toBe('trace-abc123');
    expect(response.headers['x-request-id']).toBe('trace-abc123');
  });

  // Node's own HTTP client (superagent, underneath supertest) refuses to even
  // send a header containing a raw newline or other control characters —
  // confirmed empirically: attempting it throws client-side before the
  // request reaches this server at all. That is a real, useful protection,
  // but it means those specific payloads cannot be exercised through a real
  // HTTP round trip; see the direct unit tests below for that defence
  // in depth instead. What *can* legitimately arrive over the wire and must
  // still be rejected is covered here.
  it.each([
    ['is empty', ''],
    ['contains a space', 'abc def'],
    ['contains characters outside the safe set', 'abc/../etc'],
    ['exceeds the length cap', 'a'.repeat(200)],
  ])('generates a fresh id when the incoming value %s', async (_label, invalid) => {
    const response = await request(buildApp()).get('/').set('X-Request-Id', invalid);

    expect(response.body.id).not.toBe(invalid);
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('requestId middleware — direct unit test of the regex defence', () => {
  // Defence in depth: even though no real HTTP client can deliver these
  // (see above), the middleware's own validation is asserted directly by
  // calling it with a hand-built request, independent of what any given
  // transport layer happens to permit today.
  it.each([
    ['a newline (log injection attempt)', 'abc\ninjected: true'],
    ['a carriage return', 'abc\rinjected: true'],
    ['a null byte', 'abc' + String.fromCharCode(0) + 'def'],
    ['a tab', 'abc\tdef'],
  ])('rejects an incoming value containing %s', (_label, malicious) => {
    const req = { header: vi.fn().mockReturnValue(malicious), id: undefined as unknown as string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestId(req as never, res as never, next as never);

    expect(req.id).not.toBe(malicious);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(next).toHaveBeenCalledOnce();
  });
});
