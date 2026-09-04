import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

/**
 * The test suite runs with `ENABLE_API_DOCS` unset (defaults to `false`),
 * matching production's own default — see vitest.config.ts. Testing the
 * `true` branch would require its own env, which is what `src/openapi/
 * registry.test.ts` covers directly (generating the document itself,
 * independent of whether the route is mounted).
 */
describe('GET /api/v1/docs (disabled by default)', () => {
  it('returns a plain 404, not a 403 — no route registered at all when the flag is off', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/docs');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
