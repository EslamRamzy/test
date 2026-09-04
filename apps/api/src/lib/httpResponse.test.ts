import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, sendPaginatedSuccess, sendSuccess } from './httpResponse.js';

function buildApp() {
  const app = express();
  app.get('/success', (_req, res) => {
    sendSuccess(res, { id: 1 });
  });
  app.get('/created', (_req, res) => {
    sendSuccess(res, { id: 2 }, 201);
  });
  app.get('/list', (_req, res) => {
    sendPaginatedSuccess(res, [{ id: 1 }, { id: 2 }], buildPaginationMeta(1, 12, 47));
  });
  return app;
}

describe('httpResponse helpers', () => {
  it('sendSuccess produces the documented envelope', async () => {
    const response = await request(buildApp()).get('/success');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { id: 1 } });
  });

  it('sendSuccess accepts a custom status code', async () => {
    const response = await request(buildApp()).get('/created');

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ id: 2 });
  });

  it('sendPaginatedSuccess includes meta alongside data', async () => {
    const response = await request(buildApp()).get('/list');

    expect(response.body).toEqual({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 1, pageSize: 12, total: 47, totalPages: 4 },
    });
  });
});

describe('buildPaginationMeta', () => {
  it('rounds totalPages up', () => {
    expect(buildPaginationMeta(1, 12, 47)).toEqual({
      page: 1,
      pageSize: 12,
      total: 47,
      totalPages: 4,
    });
  });

  it('reports at least 1 page even with zero results', () => {
    expect(buildPaginationMeta(1, 12, 0).totalPages).toBe(1);
  });

  it('reports exactly 1 page when total equals pageSize', () => {
    expect(buildPaginationMeta(1, 12, 12).totalPages).toBe(1);
  });
});
