import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from './errorHandler.js';
import { validate } from './validate.js';

function buildApp(schemas: Parameters<typeof validate>[0]) {
  const app = express();
  app.use(express.json());
  app.get('/items/:id', validate(schemas), (req, res) => {
    res.json({ params: req.params, query: req.query });
  });
  app.post('/items', validate(schemas), (req, res) => {
    res.json({ body: req.body });
  });
  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  it('replaces req.params with the parsed, coerced output', async () => {
    const app = buildApp({ params: z.object({ id: z.coerce.number().int().positive() }) });

    const response = await request(app).get('/items/42');

    expect(response.status).toBe(200);
    expect(response.body.params).toEqual({ id: 42 });
  });

  it('replaces req.query with parsed output including defaults', async () => {
    const app = buildApp({
      params: z.object({ id: z.coerce.number() }),
      query: z.object({ page: z.coerce.number().int().positive().default(1) }),
    });

    const response = await request(app).get('/items/1');

    expect(response.body.query).toEqual({ page: 1 });
  });

  it('rejects an invalid param with a 400 and field-level details', async () => {
    const app = buildApp({ params: z.object({ id: z.coerce.number().int().positive() }) });

    const response = await request(app).get('/items/not-a-number');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([{ field: 'id', message: expect.any(String) }]);
  });

  it('reports every failing field at once, not just the first', async () => {
    const app = buildApp({
      body: z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }),
    });

    const response = await request(app).post('/items').send({ email: 'not-an-email', name: '' });

    expect(response.status).toBe(400);
    const fields = response.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'name']);
  });

  it('rejects an unknown field on a .strict() schema (mass-assignment defence)', async () => {
    const app = buildApp({
      body: z.strictObject({ title: z.string() }),
    });

    const response = await request(app).post('/items').send({ title: 'ok', role: 'ADMIN' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('passes through when no schema is given for a given part', async () => {
    const app = buildApp({});

    const response = await request(app).get('/items/anything?whatever=1');

    expect(response.status).toBe(200);
  });

  it('reports a nested field path joined with dots', async () => {
    const app = buildApp({
      body: z.object({ profile: z.object({ email: z.string().email() }) }),
    });

    const response = await request(app)
      .post('/items')
      .send({ profile: { email: 'not-an-email' } });

    expect(response.body.error.details).toEqual([
      { field: 'profile.email', message: expect.any(String) },
    ]);
  });
});
